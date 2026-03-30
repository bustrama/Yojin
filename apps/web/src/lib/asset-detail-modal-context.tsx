import { createContext, useCallback, useContext, useState } from 'react';

interface AssetDetailModalContextValue {
  open: boolean;
  symbol: string | null;
  openAssetDetail: (symbol: string) => void;
  closeAssetDetail: () => void;
}

const AssetDetailModalContext = createContext<AssetDetailModalContextValue>({
  open: false,
  symbol: null,
  openAssetDetail: () => {},
  closeAssetDetail: () => {},
});

export function AssetDetailModalProvider({ children }: { children: React.ReactNode }) {
  const [symbol, setSymbol] = useState<string | null>(null);

  const openAssetDetail = useCallback((sym: string) => {
    setSymbol(sym.toUpperCase());
  }, []);

  const closeAssetDetail = useCallback(() => {
    setSymbol(null);
  }, []);

  return (
    <AssetDetailModalContext.Provider value={{ open: symbol !== null, symbol, openAssetDetail, closeAssetDetail }}>
      {children}
    </AssetDetailModalContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAssetDetailModal() {
  return useContext(AssetDetailModalContext);
}
