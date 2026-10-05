import React, { useState } from 'react';
import { BsSearch } from 'react-icons/bs';


const SearchTrips = () => {
  const [formState, setFormState] = useState({
    departureLocation: '',
  });

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormState((prevState) => ({
      ...prevState,
      [name]: value,
    }));
  };

  const handleFormSubmit = (event) => {
    event.preventDefault();
    const { departureLocation } = formState;
    const url = `/trips?search=${encodeURIComponent(departureLocation)}`;
    window.location.href = url;
  };

  return (
<div>
      <form onSubmit={handleFormSubmit}>
        <div className="p-1 rounded-pill shadow-sm mb-4" style={{ backgroundColor: 'rgba(255, 255, 255, 0.75)' }}>
          <div className="input-group">
            <input
              type="search"
              placeholder="Enter departure location"
              aria-label="Departure location"
              className="form-control border-0"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0)', borderRadius: '20px' }}
              name="departureLocation"
              value={formState.departureLocation}
            onChange={handleChange}
            />
            <button
              aria-label="Search trips"
              type="submit"
              className="btn btn-link text-primary rounded-pill bg-transparent border-0"
            >
              <BsSearch style={{ background: 'none' }} />
            </button>
          </div>
        </div>
      </form>
    </div>



  );
};

export default SearchTrips;
