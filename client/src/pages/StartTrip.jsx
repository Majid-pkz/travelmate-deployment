import React, { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useMutation } from "@apollo/client";
import { CREATE_TRIP } from "../utils/mutations";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "./Style/StartTrip.css";
import Auth from "../utils/auth";
import TripPhotoPicker from '../components/TripPhotoPicker';
import { photoValidationError, photoUploadError, uploadTripPhoto } from '../utils/tripPhotos';

const StartTrip = () => {
  const userId = Auth.getProfile()?.data?._id;
  const [formState, setFormState] = useState({
    creator: userId || '',
    title: "",
    description: "",
    departureLocation: "",
    destination: "",
    startDate: null,
    endDate: null,
  });

  const [createTrip, { error }] = useMutation(CREATE_TRIP);
  const [createdTrip, setCreatedTrip] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [photoError, setPhotoError] = useState('');
  const [photoSaved, setPhotoSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const choosePhoto = (file) => {
    setPhoto(file);
    setPhotoError(photoValidationError(file));
  };

  const savePhoto = async (tripId) => {
    if (!photo) return;
    try {
      await uploadTripPhoto(tripId, photo);
      setPhotoSaved(true);
      setPhotoError('');
    } catch (uploadError) {
      setPhotoError(photoUploadError(uploadError));
    }
  };

  const retryPhoto = async () => {
    if (saving || !photo || photoValidationError(photo)) return;
    setSaving(true);
    try { await savePhoto(createdTrip._id); }
    finally { setSaving(false); }
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormState({
      ...formState,
      [name]: value,
    });
  };

  const handleStartDateChange = (date) => {
    setFormState({
      ...formState,
      startDate: date,
    });
  };

  const handleEndDateChange = (date) => {
    setFormState({
      ...formState,
      endDate: date,
    });
  };

  const handleFormSubmit = async (event) => {
    event.preventDefault();
    if (saving || photoValidationError(photo)) return;
    setSaving(true);
    try {
      const result = await createTrip({
        variables: {
          ...formState,
          startDate: formState.startDate?.toISOString(),
          endDate: formState.endDate?.toISOString(),
        },
      });
      setCreatedTrip(result.data.createTrip);
      await savePhoto(result.data.createTrip._id);
    } catch (e) {
      console.error(e);
    } finally { setSaving(false); }
  };

  if (!userId) return <Navigate to="/login" replace />;
  return (
    <main className="custom-trip flex-row justify-center ">
    <div className="col-12 col-lg-6">
      <div className="card custom-card">
        <h4 className="card-header p-2 text-center">Start a Trip</h4>
        {createdTrip ? (
          <div className="p-3">
            {saving ? <output className="d-block">Saving your trip photo…</output> : <>
              <p style={{ color: "var(--black)", textAlign: "center" }}>
                Success! You may now head <Link to="/">back to the homepage.</Link>
              </p>
              <p><Link to="/my-upcoming-trips">View your trips</Link></p>
              {photoSaved && <output className="d-block">Trip photo saved.</output>}
              {photo && !photoSaved && <>
                <p>Your trip is created. You can retry saving its photo here or add one from My trips.</p>
                <TripPhotoPicker file={photo} onChange={choosePhoto} />
                {photoError && <p role="alert">{photoError}</p>}
                <button type="button" className="btn btn-primary" onClick={retryPhoto}
                  disabled={Boolean(photoValidationError(photo))}>Retry photo</button>
              </>}
            </>}
          </div>
        ) : (
          <form onSubmit={handleFormSubmit} className="trip-form">
            <fieldset disabled={saving} className="border-0 p-0">
            <div className="form-group">
              <input
                className="form-control"
                placeholder="Title"
                name="title"
                type="text"
                value={formState.title}
                onChange={handleChange}
                required 
              />
              {formState.title === "" && (
                <small className="text-danger">Title is required.</small>
              )}
            </div>
            <div className="form-group">
              <input
                className="form-control"
                placeholder="Description"
                name="description"
                type="text"
                value={formState.description}
                onChange={handleChange}
                required 
              />
              {formState.description === "" && (
                <small className="text-danger">Description is required.</small>
              )}
            </div>
            <div className="form-group">
              <input
                className="form-control"
                placeholder="Departure Location"
                name="departureLocation"
                type="text"
                value={formState.departureLocation}
                onChange={handleChange}
                required 
              />
              {formState.departureLocation === "" && (
                <small className="text-danger">
                  Departure Location is required.
                </small>
              )}
            </div>
            <div className="form-group">
              <input
                className="form-control"
                placeholder="Destination"
                name="destination"
                type="text"
                value={formState.destination}
                onChange={handleChange}
                required 
              />
              {formState.destination === "" && (
                <small className="text-danger">Destination is required.</small>
              )}
            </div>
            <div className="form-group">
              <div className="datepicker-container">
                <DatePicker
                  className="form-control custom-datepicker close-icon"
                  selected={formState.startDate}
                  onChange={handleStartDateChange}
                  dateFormat="dd/MM/yyyy"
                  minDate={new Date()}
                  isClearable
                  placeholderText="Start Date"
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <div className="datepicker-container">
                <DatePicker
                  className="form-control custom-datepicker close-icon"
                  selected={formState.endDate}
                  onChange={handleEndDateChange}
                  dateFormat="dd/MM/yyyy"
                  minDate={formState.startDate}
                  isClearable
                  placeholderText="End Date"
                  required
                />
              </div>
            </div>
            <TripPhotoPicker label="Trip photo (optional)" file={photo} onChange={choosePhoto} disabled={saving} />
            {photoError && <p role="alert">{photoError}</p>}
            <button
              className="btn btn-block btn-info"
              style={{ cursor: "pointer" }}
              type="submit"
              disabled={saving || Boolean(photoValidationError(photo))}
            >
              {saving ? 'Saving…' : 'Submit'}
            </button>
            </fieldset>
          </form>
        )}

        {error && (
          <div className="my-3 p-3 bg-danger text-white">
            {error.message}
          </div>
        )}
      </div>
    </div>
  </main>
)
};

export default StartTrip;

