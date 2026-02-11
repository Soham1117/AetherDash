// features/receiptSlice.ts
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

type LineItem = {
  type: "item" | "tax" | "discount";
  name: string;
  quantity: number;
  unit: string;
  priceAfterDiscount: number;
};

interface ReceiptState {
  image: File | null;
  result: {
    items: LineItem[];
    taxes: {
      type: string;
      amount: number;
    }[];
    discounts: {
      type: string;
      amount: number;
    }[];
    totals: {
      subTotal: number;
      taxes: number;
      serviceFee: number;
      total: number;
    };
  };
  loading: boolean;
  error: string | null;
}

const initialState: ReceiptState = {
  image: null,
  result: {
    items: [],
    taxes: [],
    discounts: [],
    totals: {
      subTotal: 0,
      taxes: 0,
      serviceFee: 0,
      total: 0,
    },
  },
  loading: false,
  error: null,
};

const receiptSlice = createSlice({
  name: "receipt",
  initialState,
  reducers: {
    setImage: (state, action: PayloadAction<File | null>) => {
      state.image = action.payload;
    },
    setResult: (state, action: PayloadAction<ReceiptState["result"]>) => {
      state.result = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    reset: (state) => {
      state.image = null;
      state.result = initialState.result;
      state.loading = false;
      state.error = null;
    },
  },
});

export const { setImage, setResult, setLoading, setError, reset } =
  receiptSlice.actions;
export default receiptSlice.reducer;
