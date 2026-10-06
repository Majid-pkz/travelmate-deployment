const { GraphQLError } = require('graphql');
const { User } = require('../models');

function fail(message, code = 'BAD_USER_INPUT') {
  throw new GraphQLError(message, { extensions: { code } });
}

function id(value) {
  if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value)) fail('Invalid record ID.');
  return value.toLowerCase();
}

async function actor(context) {
  if (!context?.user?._id) fail('Log in to continue.', 'UNAUTHENTICATED');
  if (!context.actorPromise) {
    context.actorPromise = User.findById(context.user._id).select('+tokenVersion').exec();
  }
  const user = await context.actorPromise;
  if (!user || user.tokenVersion !== (context.user.tokenVersion ?? 0)) {
    fail('Log in again to continue.', 'UNAUTHENTICATED');
  }
  return user;
}

async function self(context, suppliedId) {
  const user = await actor(context);
  if (id(suppliedId) !== String(user._id)) fail('You can only change your own records.', 'FORBIDDEN');
  return user;
}

async function admin(context) {
  const user = await actor(context);
  if (!user.isAdmin) fail('Administrator access is required.', 'FORBIDDEN');
  return user;
}

function text(value, field, max, required = false) {
  if (value === undefined || value === null) {
    if (required) fail(field + ' is required.');
    return value;
  }
  if (typeof value !== 'string') fail(field + ' must be text.');
  const result = value.trim();
  if ((required && !result) || result.length > max) fail('Enter a valid ' + field + '.');
  return result;
}

function email(value) {
  const result = text(value, 'email address', 254, true).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) fail('Enter a valid email address.');
  return result;
}

function password(value) {
  if (typeof value !== 'string' || value.length < 8 || Buffer.byteLength(value, 'utf8') > 72) {
    fail('Use a password with at least 8 characters and at most 72 bytes.');
  }
  return value;
}

function date(value, field) {
  const parsed = new Date(value);
  if (!value || !Number.isFinite(parsed.getTime())) fail('Choose a valid ' + field + '.');
  return parsed.toISOString();
}

function notFound(value, name) {
  if (!value) fail(name + ' was not found, or you do not have permission to change it.', 'NOT_FOUND');
  return value;
}

function publicError(error) {
  if (error instanceof GraphQLError) return error;
  if (error.code === 11000) return new GraphQLError('This account or profile already exists.', { extensions: { code: 'BAD_USER_INPUT' } });
  if (['ValidationError', 'CastError'].includes(error.name)) {
    return new GraphQLError('Check the supplied fields and try again.', { extensions: { code: 'BAD_USER_INPUT' } });
  }
  return new GraphQLError('The request could not be completed. Please try again.', { extensions: { code: 'INTERNAL_SERVER_ERROR' } });
}

module.exports = { actor, admin, self, id, text, email, password, date, notFound, fail, publicError };
