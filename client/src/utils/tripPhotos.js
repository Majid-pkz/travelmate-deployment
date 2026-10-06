import axios from 'axios';
import Auth from './auth';
import oceanView from '../assets/oceanView.jpg';

export const defaultTripPhoto = oceanView;

export function photoValidationError(file) {
  if (!file) return '';
  if (!['image/png', 'image/jpeg'].includes(file.type)) return 'Choose a PNG or JPEG image.';
  if (file.size > 2 * 1024 * 1024) return 'Choose an image smaller than 2 MB.';
  return '';
}

export async function uploadTripPhoto(tripId, file) {
  const error = photoValidationError(file);
  if (!file || error) throw new Error(error || 'Choose an image to upload.');
  const form = new FormData();
  form.append('image', file);
  const { data } = await axios.post('/api/images/trips/' + tripId, form, {
    headers: { Authorization: 'Bearer ' + Auth.getToken() },
  });
  return data;
}

export function photoUploadError(error) {
  return error.response?.data?.error || 'The photo could not be uploaded. Please try again.';
}

export function showDefaultTripPhoto(event) {
  const image = event.currentTarget;
  if (image.getAttribute('src') !== oceanView) image.setAttribute('src', oceanView);
}
