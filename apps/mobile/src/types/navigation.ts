export type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
};

export type MainTabParamList = {
  Map: undefined;
  Explore: undefined;
  Record: undefined;
  History: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  TrailDetail: { trailId: string };
  ActivityDetail: { activityId: string };
};
