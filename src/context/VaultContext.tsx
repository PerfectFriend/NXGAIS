import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { VaultFile, NodeRecord } from '../types/nexxus';
import { INITIAL_FILES } from '../data/mockInitialState';

/**
 * Decoy files for Anti-Torture / Panic PIN duress mode.
 */
export const DECOY_FILES: VaultFile[] = [
  {
    id: 'decoy_file_1',
    name: 'Инструкция_пользователя.pdf',
    sizeBytes: 1024 * 1024 * 1.4,
    mimeType: 'application/pdf',
    chunksCount: 90,
    uploadedAt: Date.now() - 5 * 24 * 3600 * 1000,
    encryptionAlgorithm: 'ChaCha20-Poly1305',
    storageTier: 'hot_rf6',
    rootHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    chunks: [],
  },
  {
    id: 'decoy_file_2',
    name: 'Заметки_по_учебе.txt',
    sizeBytes: 14200,
    mimeType: 'text/plain',
    chunksCount: 1,
    uploadedAt: Date.now() - 2 * 24 * 3600 * 1000,
    encryptionAlgorithm: 'ChaCha20-Poly1305',
    storageTier: 'hot_rf6',
    rootHash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
    chunks: [],
  },
];

/**
 * Value contract exposed by VaultContext.
 */
export interface VaultContextValue {
  /** Active vault file records (or decoy files in duress mode) */
  files: VaultFile[];
  /** Master files list unaffected by decoy mode */
  masterFiles: VaultFile[];
  /** Number of personal 16 GB sections allocated for private storage */
  personalSections: number;
  /** Personal private vault storage quota in GB */
  personalVaultQuotaGb: number;
  /** Total storage capacity allocated by active cluster nodes */
  totalAllocatedGb: number;
  /** Total 16 GB sections across online nodes */
  totalSectionsCount: number;
  /** Actions */
  addFile: (file: VaultFile) => void;
  deleteFile: (fileId: string) => void;
  updateFiles: (files: VaultFile[]) => void;
  setPersonalSections: (count: number) => void;
}

const VaultContext = createContext<VaultContextValue | null>(null);

interface VaultProviderProps {
  children: ReactNode;
  nodes: NodeRecord[];
  isDecoyMode?: boolean;
}

/**
 * VaultProvider manages sovereign encrypted file storage, 16 KB chunk slicing,
 * barter ratio quotas (16 GB barter -> 2.0 GB secret vault), and storage tiers.
 *
 * @param {VaultProviderProps} props - Component props containing child components and cluster node topology.
 * @returns {React.ReactElement} The rendered React Context provider.
 */
export const VaultProvider: React.FC<VaultProviderProps> = ({
  children,
  nodes,
  isDecoyMode = false,
}) => {
  const [files, setFiles] = useState<VaultFile[]>(() => {
    const saved = localStorage.getItem('nexxus_files');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        /* fallback */
      }
    }
    return INITIAL_FILES;
  });

  // Calculate storage metrics across online nodes
  const totalAllocatedGb = nodes.reduce((sum, n) => sum + (n.isOnline ? n.totalStorageAllocatedGb : 0), 0);
  const totalSectionsCount = Math.max(1, Math.floor(totalAllocatedGb / 16));

  const [personalSections, setPersonalSectionsState] = useState<number>(() => {
    const saved = localStorage.getItem('nexxus_personal_sections');
    return saved 
      ? Math.min(totalSectionsCount, Math.max(1, parseInt(saved, 10))) 
      : Math.max(2, Math.floor(totalSectionsCount * 0.25));
  });

  const personalVaultQuotaGb = personalSections * 16;

  // Persist files in localStorage when not in decoy mode
  useEffect(() => {
    if (!isDecoyMode) {
      localStorage.setItem('nexxus_files', JSON.stringify(files));
    }
  }, [files, isDecoyMode]);

  const addFile = (newFile: VaultFile) => {
    setFiles(prev => [newFile, ...prev]);
  };

  const deleteFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const updateFiles = (updatedFiles: VaultFile[]) => {
    setFiles(updatedFiles);
  };

  const setPersonalSections = (count: number) => {
    setPersonalSectionsState(count);
    localStorage.setItem('nexxus_personal_sections', count.toString());
  };

  const activeFiles = isDecoyMode ? DECOY_FILES : files;

  const contextValue: VaultContextValue = {
    files: activeFiles,
    masterFiles: files,
    personalSections,
    personalVaultQuotaGb,
    totalAllocatedGb,
    totalSectionsCount,
    addFile,
    deleteFile,
    updateFiles,
    setPersonalSections,
  };

  return <VaultContext.Provider value={contextValue}>{children}</VaultContext.Provider>;
};

/**
 * Hook to access sovereign vault storage state, chunk catalogs, and quota metrics.
 *
 * @throws {Error} If called outside of a VaultProvider.
 * @returns {VaultContextValue} The vault storage context value.
 */
export const useVault = (): VaultContextValue => {
  const context = useContext(VaultContext);
  if (!context) {
    throw new Error('useVault must be used within a VaultProvider');
  }
  return context;
};
