import { useQuery } from '@apollo/client';
import { Link, Navigate } from 'react-router-dom';
import TripCard from '../components/TripCard';
import { QUERY_MY_TRIPS } from '../utils/queries';
import Auth from '../utils/auth';

export default function MyUpcomingTrips() {
  const userId = Auth.getProfile()?.data?._id;
  const { loading, error, data, refetch } = useQuery(QUERY_MY_TRIPS, {
    variables: { travelmates: userId }, skip: !userId, fetchPolicy: 'cache-and-network',
  });
  if (!userId) return <Navigate to="/login" replace />;
  const trips = data?.myTrips ?? [];
  const organizing = trips.filter(trip => trip.creator?._id === userId);
  const joined = trips.filter(trip => trip.creator?._id !== userId);

  return (
    <main className="trip-page">
      <div className="trip-page__heading">
        <h1>My trips</h1>
        <p>Your plans, whether you're bringing people together or joining the adventure.</p>
      </div>
      {loading && !data ? <output>Loading trips…</output>
        : error ? <p role="alert">Could not load your trips. Please try again.</p>
          : <>
            <section className="trip-page__section" aria-labelledby="organizing-heading">
              <h2 id="organizing-heading" className="trip-page__section-title">Organizing <span>({organizing.length})</span></h2>
              {organizing.length ? <div className="trip-grid">
                {organizing.map(trip => <TripCard trip={trip} view="mine" onPhotoUploaded={refetch} key={trip._id} />)}
              </div> : <p className="trip-page__empty">No trips created yet. <Link to="/new-trip">Start a new trip</Link></p>}
            </section>
            <section className="trip-page__section" aria-labelledby="joined-heading">
              <h2 id="joined-heading" className="trip-page__section-title">Joined <span>({joined.length})</span></h2>
              {joined.length ? <div className="trip-grid">
                {joined.map(trip => <TripCard trip={trip} view="mine" key={trip._id} />)}
              </div> : <p className="trip-page__empty">No trips joined yet. <Link to="/trips">Explore trips</Link></p>}
            </section>
          </>}
    </main>
  );
}
