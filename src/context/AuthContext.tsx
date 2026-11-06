import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Bip39Identity, SystemPermissionItem, DeviceType } from '../types/nexxus';
import { INITIAL_IDENTITY, INITIAL_PERMISSIONS } from '../data/mockInitialState';
import { isUserOnboarded, resetUserOnboarding } from '../utils/securityPin';

/**
 * Decoy identity for anti-torture / Panic PIN duress mode.
 * Contains empty zero-balance records and an unlinked testnet identity.
 */
export const DECOY_IDENTITY: Bip39Identity = {
  ...INITIAL_IDENTITY,
  mnemonic: [
    'abandon', 'abandon', 'abandon', 'abandon', 
    'abandon', 'abandon', 'abandon', 'abandon', 
    'abandon', 'abandon', 'abandon', 'about'
  ],
  masterPublicKey: 'nx1pk_decoy_unregistered_node_0000000000000000',
  accountAddress: 'nx1q_testnet_unregistered_demo_safe',
  onionAddress: 'decoydemo9876543210.onion:9050',
  balances: {
    nexx: 0.00,
    ton: 0.00,
    usdc: 0.00,
    eth: 0.00,
    btc: 0.00,
  },
  unlockedNexx: 0.00,
  lockedNexx8Weeks: 0.00,
  vestingBatches: [],
  subscribedStorageGb: 16,
  dailyStorageExpenseNexx: 0,
};

/**
 * Value contract exposed by the AuthContext provider.
 */
export interface AuthContextValue {
  /** True if the user has completed initial BIP-39 onboarding */
  isOnboarded: boolean;
  /** True if the application session is currently locked with PIN protection */
  isLocked: boolean;
  /** True if unlocked using the duress Panic PIN, serving decoy datasets */
  isDecoyMode: boolean;
  /** Active BIP-39 sovereign identity profile (or decoy profile in duress mode) */
  identity: Bip39Identity;
  /** Master identity reference (unaffected by decoy mode for key inspection) */
  masterIdentity: Bip39Identity;
  /** System permissions state (camera, storage, battery, mesh) */
  permissions: SystemPermissionItem[];
  /** Currently selected physical device type profile */
  selectedDeviceType: DeviceType;
  /** True if the BIP-39 key inspection modal is open */
  isKeyModalOpen: boolean;
  /** Actions */
  unlockSession: (isDecoy: boolean) => void;
  quickLock: () => void;
  completeOnboarding: (newIdentity: Bip39Identity, isDonorNode?: boolean) => void;
  switchAccount: () => void;
  togglePermission: (key: string) => void;
  updateIdentity: React.Dispatch<React.SetStateAction<Bip39Identity>>;
  setIsKeyModalOpen: (open: boolean) => void;
  setSelectedDeviceType: (dev: DeviceType) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
  onDonorStorageChosen?: (isDonor: boolean, onionAddress: string) => void;
}

/**
 * AuthProvider provides centralized authentication, session locking,
 * and duress-mode decoy dataset routing for the NeXXus sovereign application.
 *
 * @param {AuthProviderProps} props - Component props containing child elements.
 * @returns {React.ReactElement} The rendered React Context provider.
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ 
  children, 
  onDonorStorageChosen 
}) => {
  const [isOnboarded, setIsOnboarded] = useState<boolean>(() => isUserOnboarded());
  const [isLocked, setIsLocked] = useState<boolean>(() => isUserOnboarded());
  const [isDecoyMode, setIsDecoyMode] = useState<boolean>(false);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [selectedDeviceType, setSelectedDeviceType] = useState<DeviceType>('android');
  const [permissions, setPermissions] = useState<SystemPermissionItem[]>(INITIAL_PERMISSIONS);

  const [identity, setIdentity] = useState<Bip39Identity>(() => {
    const saved = localStorage.getItem('nexxus_identity');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...INITIAL_IDENTITY,
          ...parsed,
          balances: {
            ...INITIAL_IDENTITY.balances,
            ...(parsed.balances || {}),
          },
          unlockedNexx: parsed.unlockedNexx ?? INITIAL_IDENTITY.unlockedNexx ?? 480,
          lockedNexx8Weeks: parsed.lockedNexx8Weeks ?? INITIAL_IDENTITY.lockedNexx8Weeks ?? 770,
          vestingBatches: Array.isArray(parsed.vestingBatches) && parsed.vestingBatches.length > 0
            ? parsed.vestingBatches
            : INITIAL_IDENTITY.vestingBatches,
        };
      } catch {
        /* fallback to initial state */
      }
    }
    return INITIAL_IDENTITY;
  });

  // Sync identity changes to persistent localStorage when not in decoy mode
  useEffect(() => {
    if (!isDecoyMode) {
      localStorage.setItem('nexxus_identity', JSON.stringify(identity));
    }
  }, [identity, isDecoyMode]);

  const unlockSession = (isDecoy: boolean) => {
    setIsDecoyMode(isDecoy);
    setIsLocked(false);
  };

  const quickLock = () => {
    setIsLocked(true);
  };

  const completeOnboarding = (newIdentity: Bip39Identity, isDonorNode = true) => {
    setIdentity(newIdentity);
    localStorage.setItem('nexxus_identity', JSON.stringify(newIdentity));
    setIsOnboarded(true);
    setIsLocked(false);
    setIsDecoyMode(false);
    onDonorStorageChosen?.(isDonorNode, newIdentity.onionAddress);
  };

  const switchAccount = () => {
    if (confirm('Вы уверены, что хотите выйти из текущего аккаунта? Убедитесь, что ваша 12-словная мнемоническая фраза сохранена.')) {
      resetUserOnboarding();
      setIsOnboarded(false);
      setIsLocked(false);
      setIsDecoyMode(false);
    }
  };

  const togglePermission = (key: string) => {
    setPermissions(prev => prev.map(p => (p.key === key ? { ...p, granted: !p.granted } : p)));
  };

  // Provide decoy identity during Panic PIN activation
  const activeIdentity = isDecoyMode ? DECOY_IDENTITY : identity;

  const contextValue: AuthContextValue = {
    isOnboarded,
    isLocked,
    isDecoyMode,
    identity: activeIdentity,
    masterIdentity: identity,
    permissions,
    selectedDeviceType,
    isKeyModalOpen,
    unlockSession,
    quickLock,
    completeOnboarding,
    switchAccount,
    togglePermission,
    updateIdentity: setIdentity,
    setIsKeyModalOpen,
    setSelectedDeviceType,
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

/**
 * Hook to access the current authentication state and actions.
 *
 * @throws {Error} If called outside of an AuthProvider.
 * @returns {AuthContextValue} The authentication context value.
 */
export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
