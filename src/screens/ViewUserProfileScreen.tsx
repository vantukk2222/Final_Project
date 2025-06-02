import React from 'react';
import ViewUserProfile from '../components/ViewUserProfile';

const ViewUserProfileScreen = ({route}) => {
  const {userId} = route.params;

  return <ViewUserProfile userId={userId} />;
};

export default ViewUserProfileScreen;
