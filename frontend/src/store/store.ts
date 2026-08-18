import { configureStore } from '@reduxjs/toolkit';
// import someReducer from './someSlice';

export const store = configureStore({
  reducer: {
    // someFeature: someReducer,
  },
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
