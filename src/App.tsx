import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SwarmProvider, useSwarm } from './context/SwarmContext';
import { VaultProvider, useVault } from './context/VaultContext';
import { MessengerProvider, useMessenger } from './context/MessengerContext';
import { MessengerView } from './components/MessengerView';
import { StorageSectionsDashboard } from './components/StorageSectionsDashboard';
import { SwarmFleetView } from './components/SwarmFleetView';
import { AppStoreModal } from './components/AppStoreModal';
import { DexMarketView } from './components/DexMarketView';
import { ManualView } from './components/ManualView';
import { NodeDaemonView } from './components/NodeDaemonView';
import { HealthDashboardView } from './components/HealthDashboardView';
import { IdentityKeyModal } from './components/IdentityKeyModal';
import { OnboardingModal } from './components/OnboardingModal';
import { LockScreen } from './components/LockScreen';
import { SplashScreen } from './components/SplashScreen';
import { SystemPermissionsModal } from './components/SystemPermissionsModal';
import { INITIAL_ORDER_BOOK } from './data/mockInitialState';
import { ArrowLeft, Lock, Server, Cpu, Activity, BookOpen } from 'lucide-react';

export type ActiveAppView = 
  | 'messenger' 
  | 'sections' 
  | 'fleet' 
  | 'appstore' 
  | 'dex' 
  | 'node' 
  | 'manual' 
  | 'health';

/**
 * AppRootContent manages the active view navigation, splash screen completion,
 * permissions wizard, and view routing across the sovereign application.
 *
 * @returns {React.ReactElement} The rendered active view or gating modal.
 */
function AppRootContent(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<ActiveAppView>('messenger');
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [hasPermissions, setHasPermissions] = useState<boolean>(() => {
    try {
      return localStorage.getItem('nexxus_permissions_granted') === 'true';
    } catch {
      return false;
    }
  });

  // Auth Context
  const {
    isOnboarded,
    isLocked,
    isDecoyMode,
    identity,
    masterIdentity,
    permissions,
    selectedDeviceType,
    isKeyModalOpen,
    unlockSession,
    quickLock,
    completeOnboarding,
    switchAccount,
    togglePermission,
    updateIdentity,
    setIsKeyModalOpen,
  } = useAuth();

  // Swarm Context
  const {
    nodes,
    currentNode,
    graceNodeId,
    graceRemainingSeconds,
    selfHealingNotification,
    setNodes,
    updateCurrentNode,
    addNewNode,
    restoreNode,
    simulateEmergencyGrace,
    expireGraceNow,
    isAutoPingActive,
    isPingingNow,
    lastPingRoundTimestamp,
    toggleAutoPing,
    triggerManualPingRound,
  } = useSwarm();

  // Vault Context
  const {
    files,
    personalSections,
    personalVaultQuotaGb,
    addFile,
    deleteFile,
    updateFiles,
  } = useVault();

  // Messenger Context
  const {
    messages,
    sendMessage,
    deleteMessage,
    forwardMessage,
    togglePrivateServer,
    toggleReaction,
    revealBurnerNote,
  } = useMessenger();

  const handleOpenDrawerTab = (
    tab: 'sections' | 'fleet' | 'appstore' | 'dex' | 'security' | 'manual' | 'splash' | 'health' | 'node'
  ) => {
    if (tab === 'security') {
      setIsKeyModalOpen(true);
    } else if (tab === 'splash') {
      setShowSplash(true);
    } else {
      setActiveTab(tab);
    }
  };

  const isWorkspaceActive = !showSplash && isOnboarded && !isLocked;

  return (
    <div className="min-h-full h-full h-[100dvh] max-h-screen w-full bg-[#0b0f17] text-slate-100 flex flex-col font-sans overflow-hidden select-none selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* 0. Sovereign Network Initialization Splash Screen */}
      {showSplash && (
        <SplashScreen
          isRegisteredAccount={isOnboarded}
          onComplete={destination => {
            setShowSplash(false);
            setHasPermissions(true);
            localStorage.setItem('nexxus_permissions_granted', 'true');
            if (destination === 'onboarding') {
              if (isOnboarded) {
                switchAccount();
              }
            } else if (destination === 'login' || isOnboarded) {
              quickLock();
            }
          }}
        />
      )}

      {/* 1. First-Launch System Permissions Wizard (if explicitly ungranted) */}
      {!showSplash && !hasPermissions && (
        <SystemPermissionsModal
          isOpen={!hasPermissions}
          onConfirm={() => {
            setHasPermissions(true);
            localStorage.setItem('nexxus_permissions_granted', 'true');
          }}
        />
      )}

      {/* 2. Onboarding Wizard if user is not onboarded */}
      {!showSplash && !isOnboarded && (
        <OnboardingModal
          isOpen={!isOnboarded}
          onComplete={completeOnboarding}
        />
      )}

      {/* 3. Security Lock Screen with doubling exponential cooldown and Panic PIN */}
      {!showSplash && isOnboarded && isLocked && (
        <LockScreen onUnlock={unlockSession} />
      )}

      {/* 4. Self-Healing Notification Toast */}
      {selfHealingNotification && (
        <div className="fixed bottom-6 right-6 z-50 max-w-lg bg-slate-900 border border-amber-500/50 p-4 rounded-2xl shadow-2xl text-xs text-amber-200 animate-slide-up flex items-start gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400 mt-1 shrink-0 animate-ping" />
          <div className="leading-relaxed font-mono">{selfHealingNotification}</div>
        </div>
      )}

      {/* 5. PRIMARY APPLICATION ROUTED VIEWS (Only rendered when workspace is unlocked) */}
      {isWorkspaceActive && (
        <>
          {/* A. Messenger View */}
          {activeTab === 'messenger' && (
            <MessengerView
              messages={messages}
              onSendMessage={sendMessage}
              onDeleteMessage={deleteMessage}
              onForwardMessage={forwardMessage}
              onToggleReaction={toggleReaction}
              onRevealBurnerNote={revealBurnerNote}
              currentNode={currentNode}
              onTogglePrivateServer={togglePrivateServer}
              identity={identity}
              files={files}
              onAddFile={addFile}
              onDeleteFile={deleteFile}
              nodes={nodes}
              personalSectionsCount={personalSections}
              personalVaultQuotaGb={personalVaultQuotaGb}
              onOpenDrawerTab={handleOpenDrawerTab}
              onQuickLock={quickLock}
              onSwitchAccount={switchAccount}
              isDecoyMode={isDecoyMode}
            />
          )}

      {/* B. Storage Sections Dashboard */}
      {activeTab === 'sections' && (
        <StorageSectionsDashboard
          nodes={nodes}
          onUpdateNodes={setNodes}
          identity={identity}
          onNavigateBackToChat={() => setActiveTab('messenger')}
        />
      )}

      {/* C. Swarm Fleet View */}
      {activeTab === 'fleet' && (
        <div className="flex-1 flex flex-col bg-[#0b0f17] overflow-hidden h-full">
          <div className="bg-slate-900/95 border-b border-slate-800 px-3 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setActiveTab('messenger')}
                className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 text-xs font-semibold shrink-0 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Назад в Чат</span>
                <span className="sm:hidden">Чат</span>
              </button>
              <div className="min-w-0">
                <h1 className="text-xs sm:text-base font-bold text-white font-mono flex items-center gap-1.5 truncate">
                  <Server className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span className="truncate">Флот Устройств NeXXus Swarm</span>
                </h1>
                <p className="text-[10px] text-slate-400 hidden sm:block truncate">
                  Управление подключенными смартфонами, Ubuntu-серверами и нодами
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={quickLock}
              className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-300 transition flex items-center gap-1 text-xs font-mono shrink-0 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Заблокировать</span>
            </button>
          </div>

          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <SwarmFleetView
              nodes={nodes}
              identity={identity}
              vaultFiles={files}
              onUpdateFiles={updateFiles}
              onToggleNodeOnline={restoreNode}
              onSimulateEmergencyGrace={simulateEmergencyGrace}
              onExpireGraceNow={expireGraceNow}
              onAddNewNode={addNewNode}
              graceNodeId={graceNodeId}
              graceRemainingSeconds={graceRemainingSeconds}
              onOpenHealthDashboard={() => setActiveTab('health')}
              isAutoPingActive={isAutoPingActive}
              isPingingNow={isPingingNow}
              lastPingRoundTimestamp={lastPingRoundTimestamp}
              onToggleAutoPing={toggleAutoPing}
              onTriggerManualPing={triggerManualPingRound}
            />
          </div>
        </div>
      )}

      {/* D. dApp Store */}
      {activeTab === 'appstore' && (
        <AppStoreModal
          onNavigateBackToChat={() => setActiveTab('messenger')}
          onOpenVault={() => setActiveTab('messenger')}
          onOpenNodeDaemon={() => setActiveTab('node')}
          identity={identity}
        />
      )}

      {/* E. DEX Exchange */}
      {activeTab === 'dex' && (
        <div className="flex-1 flex flex-col bg-[#0b0f17] overflow-hidden h-full">
          <div className="bg-slate-900/95 border-b border-slate-800 px-3 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setActiveTab('messenger')}
                className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 text-xs font-semibold shrink-0 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Назад в Чат</span>
                <span className="sm:hidden">Чат</span>
              </button>
              <div className="min-w-0">
                <h1 className="text-xs sm:text-base font-bold text-white font-mono flex items-center gap-1.5 truncate">
                  <Activity className="w-4 h-4 text-yellow-400 shrink-0" />
                  <span className="truncate">Децентрализованная Биржа (DEX)</span>
                </h1>
                <p className="text-[10px] text-slate-400 hidden sm:block truncate">
                  Мгновенный обмен NEXX, TON, USDC и BTC без посредников
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={quickLock}
              className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-300 transition flex items-center gap-1 text-xs font-mono shrink-0 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Заблокировать</span>
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            <DexMarketView
              identity={identity}
              nodes={nodes}
              onUpdateIdentity={updateIdentity}
              orders={INITIAL_ORDER_BOOK}
            />
          </div>
        </div>
      )}

      {/* F. Manual & GitHub Repo */}
      {activeTab === 'manual' && (
        <div className="flex-1 flex flex-col bg-[#0b0f17] overflow-hidden h-full">
          <div className="bg-slate-900/95 border-b border-slate-800 px-3 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setActiveTab('messenger')}
                className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 text-xs font-semibold shrink-0 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Назад в Чат</span>
                <span className="sm:hidden">Чат</span>
              </button>
              <div className="min-w-0">
                <h1 className="text-xs sm:text-base font-bold text-white font-mono flex items-center gap-1.5 truncate">
                  <BookOpen className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="truncate">Инструкция & Репозиторий</span>
                </h1>
                <p className="text-[10px] text-slate-400 hidden sm:block truncate">
                  Установка ноды на Ubuntu Linux, Android, GitHub PerfectFriend/NeXXus-Node
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={quickLock}
              className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-300 transition flex items-center gap-1 text-xs font-mono shrink-0 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Заблокировать</span>
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            <ManualView
              onNavigateTab={tab => {
                if (tab === 'messenger') setActiveTab('messenger');
                else if (tab === 'fleet') setActiveTab('fleet');
                else if (tab === 'dex') setActiveTab('dex');
              }}
              onOpenBip39Modal={() => setIsKeyModalOpen(true)}
            />
          </div>
        </div>
      )}

      {/* G. Node Daemon View */}
      {activeTab === 'node' && (
        <div className="flex-1 flex flex-col bg-[#0b0f17] overflow-hidden">
          <div className="bg-slate-900/90 border-b border-slate-800 px-3 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setActiveTab('messenger')}
                className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 text-xs font-semibold shrink-0 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Назад в Чат</span>
                <span className="sm:hidden">Чат</span>
              </button>
              <div className="min-w-0">
                <h1 className="text-xs sm:text-base font-bold text-white font-mono flex items-center gap-1.5 truncate">
                  <Cpu className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="truncate">Демон Ноды: {currentNode.name}</span>
                </h1>
                <p className="text-[10px] text-slate-400 hidden sm:block truncate">
                  Статус фонового сервиса, Tor Circuit, температура и системные разрешения
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={quickLock}
              className="p-2 rounded-xl bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-300 transition flex items-center gap-1 text-xs font-mono cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" /> Заблокировать
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <NodeDaemonView
              currentNode={currentNode}
              onUpdateCurrentNode={updateCurrentNode}
              permissions={permissions}
              onTogglePermission={togglePermission}
              deviceType={selectedDeviceType}
            />
          </div>
        </div>
      )}

      {/* H. Health Dashboard (D3.js Real-time Telemetry) */}
      {activeTab === 'health' && (
        <HealthDashboardView
          nodes={nodes}
          identity={identity}
          vaultFiles={files}
          onNavigateBack={() => setActiveTab('messenger')}
        />
      )}

          {/* BIP-39 Key Inspection Modal */}
          {!isDecoyMode && (
            <IdentityKeyModal
              isOpen={isKeyModalOpen}
              onClose={() => setIsKeyModalOpen(false)}
              identity={masterIdentity}
              onUpdateIdentity={updateIdentity}
            />
          )}
        </>
      )}
    </div>
  );
}

/**
 * App is the root coordinator of NeXXus, nesting domain Context Providers:
 * AuthProvider -> SwarmProvider -> VaultProvider -> MessengerProvider -> AppRootContent.
 *
 * @returns {React.ReactElement} The root application element.
 */
export default function App(): React.ReactElement {
  return (
    <AuthProvider>
      <AppWithSwarm />
    </AuthProvider>
  );
}

function AppWithSwarm(): React.ReactElement {
  const { isDecoyMode } = useAuth();

  return (
    <SwarmProvider isDecoyMode={isDecoyMode}>
      <AppWithVaultAndMessenger />
    </SwarmProvider>
  );
}

function AppWithVaultAndMessenger(): React.ReactElement {
  const { isDecoyMode } = useAuth();
  const { nodes, currentNode, updateCurrentNode } = useSwarm();

  return (
    <VaultProvider nodes={nodes} isDecoyMode={isDecoyMode}>
      <MessengerProvider
        currentNode={currentNode}
        onUpdateCurrentNode={updateCurrentNode}
        isDecoyMode={isDecoyMode}
      >
        <AppRootContent />
      </MessengerProvider>
    </VaultProvider>
  );
}
