import React from 'react';
import { Text } from 'react-native';

const AppText = ({ style, ...props }) => (
  <Text {...props} style={[{ fontFamily: 'NunitoSans-Regular' }, style]} />
);

export default AppText;
