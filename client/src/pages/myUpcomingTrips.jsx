import React from 'react';
import { useQuery } from '@apollo/client';
import { defaultTripPhoto, showDefaultTripPhoto } from '../utils/tripPhotos';
import TripPhotoUpload from '../components/TripPhotoUpload';
import { QUERY_MY_TRIPS } from '../utils/queries';
import Auth from '../utils/auth';
import { Navigate } from 'react-router-dom';

const MyUpcomingTrips = () => {
  const userId = Auth.getProfile()?.data?._id;
  const { loading, error, data, refetch } = useQuery(QUERY_MY_TRIPS, {
    variables: { travelmates: userId },
    skip: !userId,
    fetchPolicy: 'cache-and-network',
  });
//   console.log(data.myTrips)
const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString();
    return `${day}/${month}/${year}`;
  };

  if (!userId) return <Navigate to="/login" replace />;
  if (loading && !data) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  const { myTrips } = data;

  if (!myTrips || myTrips.length === 0) {
    return <div>No trips found.</div>;
  }

  return (
    <div className="row">
    {myTrips.map((trip) => (
      <div key={trip._id} className="col-md-6 col-lg-4" style={{paddingLeft:'20px', paddingRight:'25px', width: '100%'}}>
        <div className="card shadow ">
          {/* Display trip details */}
          <img src={trip.image || defaultTripPhoto} alt={trip.title} onError={showDefaultTripPhoto}
            className="card-img-top" height={300} width="100%" style={{ objectFit: 'cover' }} />
          <div className="card-body">
            <h2 className="card-title" style={{ color: '#333333' }}>
              {trip.title}
            </h2>
            <p className="card-text">{trip.description}</p>
            <p className="card-text" style={{ color: '#333333' }}>
              Departure: {trip.departureLocation}
            </p>
            <p className="card-text" style={{ color: '#333333' }}>
              Destination: {trip.destination}
            </p>
            <p className="card-text" style={{ color: '#333333' }}>
              Start Date: {` ${formatDate(trip.startDate)}`}
            </p>
            <p className="card-text" style={{ color: '#333333' }}>
              End Date: {formatDate(trip.endDate)}
            </p>

            <h3>Travelmates:</h3>
            {trip.travelmates.map((travelmate) => (
              <div key={travelmate._id}>
                <p style={{ color: '#333333' }}>{travelmate.firstname}{travelmate.email && <> - <a href={'mailto:' + travelmate.email}>{travelmate.email}</a></>}</p>
              </div>
            ))}
            {trip.creator?._id === userId && <TripPhotoUpload trip={trip} onUploaded={refetch} />}
          </div>
        </div>
      </div>
    ))}
  </div>
  );
};

export default MyUpcomingTrips;
