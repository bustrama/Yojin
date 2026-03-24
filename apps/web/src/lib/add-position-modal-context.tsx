import { createContext, useCallback, useContext, useState } from 'react';

interface AddPositionModalContextValue {
  open: boolean;
  openModal: () => void;
  closeModal: () => void;
}

const AddPositionModalContext = createContext<AddPositionModalContextValue>({
  open: false,
  openModal: () => {},
  closeModal: () => {},
});

export function AddPositionModalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const openModal = useCallback(() => setOpen(true), []);
  const closeModal = useCallback(() => setOpen(false), []);

  return (
    <AddPositionModalContext.Provider value={{ open, openModal, closeModal }}>
      {children}
    </AddPositionModalContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAddPositionModal() {
  return useContext(AddPositionModalContext);
}
