import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ApolloClient, ApolloProvider, InMemoryCache, createHttpLink, } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import Auth from './utils/auth';
import { apiUrl } from './utils/api.mjs';
import ApiStatus from './components/ApiStatus';


import Home from './pages/Home/Home';
const Signup = lazy(() => import('./pages/Signup'));
const FileUpload = lazy(() => import('./pages/FileUpload'));
const RecipeReviewCard = lazy(() => import('./pages/TestCard'));
const Trip = lazy(() => import('./pages/Trip'));
const StartTrip = lazy(() => import('./pages/StartTrip'));
import Header from './components/Header/Header';
import Footer from './components/Footer/Footer';
const LoginTest = lazy(() => import('./pages/Login'));
const MyUpcomingTrips = lazy(() => import('./pages/myUpcomingTrips'));
const Profile = lazy(() => import('./pages/createProfile'));
const PersonalProfile = lazy(() => import('./pages/displayProfile'));
const GroupExample = lazy(() => import('./pages/ProfileCards'));
const NotFound = lazy(() => import('./pages/NotFound'));

function PrivatePage({ children }) {
  return Auth.loggedIn() ? children : <Navigate to="/login" replace />;
}

// Construct our main GraphQL API endpoint
const httpLink = createHttpLink({
  uri: apiUrl('/graphql'),
});

// Construct request middleware that will attach the JWT token to every request as an `authorization` header
const authLink = setContext((_, { headers }) => {
  // get the authentication token from local storage if it exists
  const token = localStorage.getItem('id_token');
  // return the headers to the context so httpLink can read them
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  };
});

const client = new ApolloClient({
  // Set up our client to execute the `authLink` middleware prior to making the request to our GraphQL API
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
});

function refreshLiveQueries() {
  // Recover mounted reads after a cold start; never replay submitted mutations.
  void client.refetchQueries({ include: 'active' }).catch(() => {});
}

function App() {
  return (
    <ApolloProvider client={client}>
      <Router>
        <Header />
        <ApiStatus onReady={refreshLiveQueries} />
        <Suspense fallback={<output className="d-block text-center py-4">Loading page...</output>}>
        <Routes>
          <Route
            path="/login"
            element={<LoginTest />}
          />
          <Route
            path="/signup"
            element={<Signup />}
          />
          <Route
            path="/"
            element={<Home />}
          />
          <Route
            path="/trips"
            element={<Trip />}
          />

          <Route
            path="/new-trip"
            element={<PrivatePage><StartTrip /></PrivatePage>}
          />
          <Route
            path="/single"
            element={<RecipeReviewCard />}
          />

          <Route
            path="/upload"
            element={<PrivatePage><FileUpload /></PrivatePage>}
          />

          <Route
            path="/create-profile"
            element={<PrivatePage><Profile /></PrivatePage>}
          />
          <Route
            path="/my-profile"
            element={<PrivatePage><PersonalProfile /></PrivatePage>}
          />
          <Route
            path="/all-profiles"
            element={<GroupExample />}
          />

          <Route
            path="/my-upcoming-trips"
            element={<PrivatePage><MyUpcomingTrips /></PrivatePage>}
          />





          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
        {/* </div> */}
        <Footer />
        {/* </div> */}
      </Router>
    </ApolloProvider>
  );
}

export default App;
