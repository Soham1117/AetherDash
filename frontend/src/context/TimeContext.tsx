import { createContext, useContext, useState, ReactNode } from "react";

interface TimeContextType {
  timeFilterType: string;
  start: string;
  end: string;
  setTimeFilterType: (type: string) => void;
  setStart: (start: string) => void;
  setEnd: (end: string) => void;
}
const TimeContext = createContext<TimeContextType | undefined>(undefined);

interface TimeProviderProps {
  children: ReactNode;
}

export const TimeProvider = ({ children }: TimeProviderProps) => {
  const [timeFilterType, setTimeFilterType] = useState<string>("");
  const [start, setStart] = useState<string>("");
  const [end, setEnd] = useState<string>("");

  return (
    <TimeContext.Provider
      value={{
        timeFilterType,
        start,
        end,
        setTimeFilterType,
        setStart,
        setEnd,
      }}
    >
      {children}
    </TimeContext.Provider>
  );
};

export const useTime = () => {
  const context = useContext(TimeContext);
  if (!context) {
    throw new Error("useTime must be used within a TimeProvider");
  }
  return context;
};
