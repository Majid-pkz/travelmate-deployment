const { Trip, User, TripType, Profile, Interest } = require('../models');
const { signToken } = require('../utils/auth');
const access = require('../utils/access');

const tripPopulation = [
  { path: 'creator', populate: { path: 'publicProfile', select: 'image profileUser' } },
  { path: 'tripType' },
  { path: 'travelmates' },
];
const profilePopulation = [
  { path: 'profileUser' },
  { path: 'interests' },
  { path: 'createdTrips', populate: tripPopulation },
];

async function profileFields(params) {
  const fields = {};
  for (const [key, maximum] of [['location', 120], ['gender', 30], ['bio', 2000]]) {
    if (params[key] !== undefined) fields[key] = access.text(params[key], key, maximum);
  }
  if (params.age !== undefined) {
    if (params.age !== null && (!Number.isInteger(params.age) || params.age < 0 || params.age > 120)) {
      access.fail('Age must be between 0 and 120.');
    }
    fields.age = params.age;
  }
  if (params.interests !== undefined) {
    const ids = [...new Set((params.interests ?? []).map(access.id))];
    if (ids.length > 20 || await Interest.countDocuments({ _id: { $in: ids } }) !== ids.length) {
      access.fail('Choose interests from the available list.');
    }
    fields.interests = ids;
  }
  return fields;
}

async function ownProfile(context, profileId, change) {
  const user = await access.actor(context);
  const profile = await Profile.findOneAndUpdate(
    { _id: access.id(profileId), profileUser: user._id },
    change, { new: true, runValidators: true },
  ).populate(profilePopulation);
  return access.notFound(profile, 'Profile');
}

const resolvers = {
  User: {
    email: async (user, args, context) => {
      if (context?.authenticatedUserIds?.has(String(user._id))) return user.email;
      if (!context?.user) return null;
      const current = await access.actor(context);
      if (current.isAdmin || String(current._id) === String(user._id)) return user.email;
      // Contact details are shared only by people on the same trip.
      const shared = await Trip.exists({ $and: [
        { $or: [{ creator: current._id }, { travelmates: current._id }] },
        { $or: [{ creator: user._id }, { travelmates: user._id }] },
      ] });
      return shared ? user.email : null;
    },
    isAdmin: (user, args, context) =>
      context?.user?._id === String(user._id) ? user.isAdmin : null,
  },
  Profile: {
    createdTrips: (profile) => (profile.createdTrips ?? []).filter(Boolean),
    tripCount: (profile) => (profile.createdTrips ?? []).filter(Boolean).length,
    interests: (profile) => (profile.interests ?? []).filter(Boolean),
    joinedDate: (profile) => profile.joinedDate ? new Date(profile.joinedDate).toISOString() : null,
  },
  Trip: {
    creatorProfileImage: (trip) => trip.creator?.publicProfile?.image ?? null,
    // Older records may contain the organizer as a member. Display them only as organizer.
    travelmates: (trip) => (trip.travelmates ?? []).filter(user => user && String(user._id) !== String(trip.creator?._id)),
  },
  Query: {
    users: async (parent, args, context) => {
      await access.admin(context);
      return User.find({}).limit(100);
    },
    user: async (parent, { id }) => User.findById(access.id(id)),
    profiles: async () => Profile.find({}).limit(50).populate(profilePopulation),
    profile: async (parent, { id }) => Profile.findOne({ profileUser: access.id(id) }).populate(profilePopulation),
    profileExist: async (parent, { profileUser }, context) => {
      const user = await access.self(context, profileUser);
      return Profile.findOne({ profileUser: user._id });
    },
    myTrips: async (parent, { travelmates }, context) => {
      const user = await access.self(context, travelmates);
      const trips = await Trip.find({ $or: [{ creator: user._id }, { travelmates: user._id }] })
        .limit(100).populate(tripPopulation);
      return trips.filter(trip => trip.creator);
    },
    trips: async () => {
      const trips = await Trip.find({}).limit(50).populate(tripPopulation);
      return trips.filter(trip => trip.creator);
    },
    searchTrips: async (parent, { departureLocation }) => {
      const term = access.text(departureLocation ?? '', 'departure location', 120);
      const escaped = term.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      const trips = await Trip.find({ departureLocation: { $regex: escaped, $options: 'i' } })
        .limit(50).populate(tripPopulation);
      return trips.filter(trip => trip.creator);
    },
    trip: async (parent, { id }) => {
      const trip = await Trip.findById(access.id(id)).populate(tripPopulation);
      return trip?.creator ? trip : null;
    },
    tripTypes: async () => TripType.find({}).limit(100),
    tripType: async (parent, { id }) => TripType.findById(access.id(id)),
    interests: async () => Interest.find({}).limit(100),
    interest: async (parent, { id }) => Interest.findById(access.id(id)),
  },
  Mutation: {
    login: async (parent, { email, password }, context) => {
      const user = await User.findOne({ email: access.email(email) }).select('+password +tokenVersion');
      if (!user || !await user.isCorrectPassword(password)) {
        access.fail('Incorrect email or password.', 'UNAUTHENTICATED');
      }
      context.authenticatedUserIds ??= new Set();
      context.authenticatedUserIds.add(String(user._id));
      return { token: signToken(user), user };
    },
    createUser: async (parent, params, context) => {
      const user = await User.create({
        firstname: access.text(params.firstname, 'first name', 50, true),
        lastname: access.text(params.lastname, 'last name', 50, true),
        email: access.email(params.email),
        password: access.password(params.password),
        isAdmin: false,
      });
      context.authenticatedUserIds ??= new Set();
      context.authenticatedUserIds.add(String(user._id));
      return { token: signToken(user), user };
    },
    createProfile: async (parent, params, context) => {
      const user = await access.self(context, params.profileUser);
      if (await Profile.exists({ profileUser: user._id })) access.fail('You already have a profile.');
      const profile = await Profile.create({
        ...await profileFields(params),
        profileUser: user._id,
        joinedDate: new Date(),
        verified: false,
      });
      return profile.populate(profilePopulation);
    },
    createTrip: async (parent, params, context) => {
      const user = await access.self(context, params.creator);
      const profile = access.notFound(await Profile.findOne({ profileUser: user._id }), 'Profile');
      const startDate = access.date(params.startDate, 'start date');
      const endDate = access.date(params.endDate, 'end date');
      if (endDate < startDate) access.fail('End date must be on or after the start date.');
      const tripType = params.tripType ? access.id(params.tripType) : null;
      if (tripType && !await TripType.exists({ _id: tripType })) access.fail('Choose an available trip type.');
      const trip = await Trip.create({
        creator: user._id,
        title: access.text(params.title, 'title', 120, true),
        description: access.text(params.description, 'description', 3000, true),
        departureLocation: access.text(params.departureLocation, 'departure location', 120, true),
        destination: access.text(params.destination, 'destination', 120, true),
        meetupPoint: access.text(params.meetupPoint, 'meetup point', 200),
        startDate, endDate, tripType, approvedTrip: false, published: true,
      });
      try {
        await Profile.updateOne({ _id: profile._id, profileUser: user._id }, { $addToSet: { createdTrips: trip._id } });
      } catch (error) {
        await Trip.deleteOne({ _id: trip._id, creator: user._id });
        throw error;
      }
      return trip.populate(tripPopulation);
    },
    createTripType: async (parent, { tripType }, context) => {
      await access.admin(context);
      return TripType.create({ tripType: access.text(tripType, 'trip type', 80, true) });
    },
    createInterests: async (parent, { label }, context) => {
      await access.admin(context);
      return Interest.create({ label: [access.text(label, 'interest', 80, true)] });
    },
    updateUser: async (parent, params, context) => {
      const current = await access.self(context, params.id);
      const user = access.notFound(await User.findById(current._id).select('+password +tokenVersion'), 'Account');
      if (params.firstname !== undefined) user.firstname = access.text(params.firstname, 'first name', 50, true);
      if (params.lastname !== undefined) user.lastname = access.text(params.lastname, 'last name', 50, true);
      if (params.email !== undefined) user.email = access.email(params.email);
      if (params.password !== undefined) {
        user.password = access.password(params.password);
        user.tokenVersion += 1;
      }
      await user.save();
      return user;
    },
    updateProfile: async (parent, params, context) => {
      // This endpoint's id is the account ID, matching the existing profile form.
      const user = await access.self(context, params.id);
      const profile = await Profile.findOneAndUpdate(
        { profileUser: user._id }, { $set: await profileFields(params) },
        { new: true, runValidators: true },
      ).populate(profilePopulation);
      return access.notFound(profile, 'Profile');
    },
    removeTrip: async (parent, { id }, context) => {
      const user = await access.actor(context);
      const trip = await Trip.findOneAndDelete({ _id: access.id(id), creator: user._id }).populate(tripPopulation);
      access.notFound(trip, 'Trip');
      await Profile.updateMany({ createdTrips: trip._id }, { $pull: { createdTrips: trip._id } });
      return trip;
    },
    joinTrip: async (parent, { id, userJoining }, context) => {
      const user = await access.self(context, userJoining);
      const tripId = access.id(id);
      const existing = access.notFound(await Trip.findById(tripId).select('creator'), 'Trip');
      if (String(existing.creator) === String(user._id)) access.fail("You're already organizing this trip.", 'FORBIDDEN');
      if (!await Profile.exists({ profileUser: user._id })) access.fail('Create your profile before joining a trip.');
      const trip = await Trip.findOneAndUpdate(
        { _id: tripId, creator: { $ne: user._id } }, { $addToSet: { travelmates: user._id } }, { new: true },
      ).populate(tripPopulation);
      return access.notFound(trip, 'Trip');
    },
    deleteProfile: async (parent, { id }, context) => {
      const user = await access.actor(context);
      if (await Trip.exists({ creator: user._id })) access.fail('Remove your created trips before deleting your profile.');
      const profile = await Profile.findOneAndDelete({ _id: access.id(id), profileUser: user._id });
      return access.notFound(profile, 'Profile');
    },
    deleteUser: async (parent, { id }, context) => {
      const user = await access.self(context, id);
      const trips = await Trip.find({ creator: user._id }).select('_id');
      const ids = trips.map(trip => trip._id);
      await Trip.deleteMany({ creator: user._id });
      await Trip.updateMany({ travelmates: user._id }, { $pull: { travelmates: user._id } });
      await Profile.updateMany({ createdTrips: { $in: ids } }, { $pull: { createdTrips: { $in: ids } } });
      await Profile.deleteMany({ profileUser: user._id });
      return User.findByIdAndDelete(user._id);
    },
    removeAnInterest: async (parent, { id, interestId }, context) =>
      ownProfile(context, id, { $pull: { interests: access.id(interestId) } }),
    addAnInterest: async (parent, { id, interestId }, context) => {
      await access.actor(context);
      if (!await Interest.exists({ _id: access.id(interestId) })) access.fail('Choose an available interest.');
      return ownProfile(context, id, { $addToSet: { interests: interestId } });
    },
  },
};

// Keep database error details, hashes and supplied credentials out of API errors.
for (const fields of Object.values(resolvers)) {
  for (const [name, resolver] of Object.entries(fields)) {
    fields[name] = async (...args) => {
      try { return await resolver(...args); }
      catch (error) { throw access.publicError(error); }
    };
  }
}
module.exports = resolvers;
