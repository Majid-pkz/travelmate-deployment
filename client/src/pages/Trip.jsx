import { useLocation } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { SEARCH_TRIPS } from '../utils/queries';
import TripCard from '../components/TripCard';

export default function Trips() {
  const location = useLocation();
  const search = new URLSearchParams(location.search).get('search') || '';
  const { loading, error, data } = useQuery(SEARCH_TRIPS, {
    variables: { departureLocation: search }, fetchPolicy: 'cache-and-network',
  });
  return (
    <main className="trip-page">
      <div className="trip-page__heading">
        <h1>Explore trips</h1>
        <p>{search ? `Find travelmates departing from ${search}.` : 'Find a trip and share your next adventure.'}</p>
      </div>
      {loading && !data ? <output>Loading trips…</output>
        : error ? <p role="alert">Could not load trips. Please try again.</p>
          : data?.searchTrips?.length ? <div className="trip-grid">
            {data.searchTrips.map(trip => <TripCard trip={trip} key={trip._id} />)}
          </div> : <p className="trip-page__empty">No trips found. Try Again!</p>}
    </main>
  );
}
