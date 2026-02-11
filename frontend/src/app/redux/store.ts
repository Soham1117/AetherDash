import { configureStore } from "@reduxjs/toolkit";
import receiptReducer from "./receiptSlice";

export const store = configureStore({
  reducer: {
    receipt: receiptReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
