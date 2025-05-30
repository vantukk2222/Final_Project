
export type Language = {
  code: string;
  transCode: string;
  name: string;
};

export type Member = {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  language: string;
  translateCode: string;
  role: string;
};

export type UserProps = {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  _user?: {
    uid: string;
    email: string;
    displayName: string;
    photoURL: string;
  };
};
