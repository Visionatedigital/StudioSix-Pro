/**
 * AI Settings Modal
 * 
 * Comprehensive modal for configuring all AI features in StudioSix:
 * - AI Chat settings (provider, model, prompts, etc.)
 * - AI Render settings (provider, model, quality, etc.)
 * - BYOK configuration
 * - Usage caps and monitoring
 * - Privacy settings
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  XMarkIcon,
  Cog6ToothIcon,
  ChatBubbleLeftRightIcon,
  CameraIcon,
  KeyIcon,
  ChartBarIcon,
  ShieldCheckIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline';
import aiSettingsService from '../services/AISettingsService';
import subscriptionService from '../services/SubscriptionService';
import tokenUsageService from '../services/TokenUsageService';

const AISettingsModal = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('chat');
  const [settings, setSettings] = useState(null);
  const [usage, setUsage] = useState(null);
  const [showApiKeys, setShowApiKeys] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Load settings on mount
  useEffect(() => {
    if (isOpen) {
      const currentSettings = aiSettingsService.getSettings();
      const currentUsage = aiSettingsService.getUsage();
      setSettings(currentSettings);
      setUsage(currentUsage);
      setHasChanges(false);
    }
  }, [isOpen]);

  // Listen for settings changes
  useEffect(() => {
    const unsubscribe = aiSettingsService.onSettingsChange((newSettings) => {
      setSettings(newSettings);
      setHasChanges(false);
    });
    return unsubscribe;
  }, []);

  const handleSettingChange = useCallback((section, key, value) => {
    if (!settings) return;
    
    const newSettings = {
      ...settings,
      [section]: {
        ...settings[section],
        [key]: value
      }
    };
    
    setSettings(newSettings);
    setHasChanges(true);
  }, [settings]);

  const handleSave = useCallback(async () => {
    if (!settings) return;
    
    setIsLoading(true);
    try {
      Object.keys(settings).forEach(section => {
        aiSettingsService.updateSection(section, settings[section]);
      });
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, [settings]);

  const handleReset = useCallback(() => {
    if (window.confirm('Are you sure you want to reset all settings to defaults?')) {
      aiSettingsService.resetToDefaults();
      setSettings(aiSettingsService.getSettings());
      setHasChanges(false);
    }
  }, []);

  const handleExport = useCallback(() => {
    const exportData = aiSettingsService.exportSettings();
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'studiosix_ai_settings.json';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleImport = useCallback((event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const success = aiSettingsService.importSettings(e.target.result);
        if (success) {
          setSettings(aiSettingsService.getSettings());
          setHasChanges(false);
          alert('Settings imported successfully!');
        } else {
          alert('Failed to import settings. Please check the file format.');
        }
      } catch (error) {
        alert('Failed to import settings: ' + error.message);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }, []);

  if (!isOpen || !settings) return null;

  const tabs = [
    { id: 'chat', name: 'AI Chat', icon: ChatBubbleLeftRightIcon },
    { id: 'render', name: 'AI Render', icon: CameraIcon },
    { id: 'keys', name: 'API Keys', icon: KeyIcon },
    { id: 'usage', name: 'Usage', icon: ChartBarIcon },
    { id: 'privacy', name: 'Privacy', icon: ShieldCheckIcon }
  ];

  const providers = aiSettingsService.getProviders();

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <Cog6ToothIcon className="w-6 h-6 text-studiosix-400" />
            <div>
              <h2 className="text-xl font-semibold text-white">AI Settings</h2>
              {aiSettingsService.getCurrentUserId() && (
                <p className="text-sm text-gray-400">User: {aiSettingsService.getCurrentUserId()}</p>
              )}
              {!aiSettingsService.getCurrentUserId() && (
                <p className="text-sm text-yellow-400">Anonymous Session</p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {hasChanges && (
              <span className="text-sm text-yellow-400 flex items-center space-x-1">
                <ExclamationTriangleIcon className="w-4 h-4" />
                <span>Unsaved changes</span>
              </span>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-700">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-studiosix-400 border-b-2 border-studiosix-400 bg-studiosix-500/10'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'chat' && <ChatSettingsTab settings={settings.aiChat} providers={providers} onChange={(key, value) => handleSettingChange('aiChat', key, value)} />}
          {activeTab === 'render' && <RenderSettingsTab settings={settings.aiRender} providers={providers} onChange={(key, value) => handleSettingChange('aiRender', key, value)} />}
          {activeTab === 'keys' && <APIKeysTab settings={settings.byok} providers={providers} showKeys={showApiKeys} onToggleShowKeys={() => setShowApiKeys(!showApiKeys)} onChange={(key, value) => handleSettingChange('byok', key, value)} />}
          {activeTab === 'usage' && <UsageTab settings={settings.usage} usage={usage} onChange={(key, value) => handleSettingChange('usage', key, value)} />}
          {activeTab === 'privacy' && <PrivacyTab settings={settings.privacy} onChange={(key, value) => handleSettingChange('privacy', key, value)} />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-700">
          <div className="flex items-center space-x-2">
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
              id="import-settings"
            />
            <label
              htmlFor="import-settings"
              className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-400 hover:text-white border border-gray-600 rounded-lg hover:bg-gray-800 cursor-pointer transition-colors"
            >
              <ArrowUpTrayIcon className="w-4 h-4" />
              <span>Import</span>
            </label>
            <button
              onClick={handleExport}
              className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-400 hover:text-white border border-gray-600 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              <span>Export</span>
            </button>
            <button
              onClick={handleReset}
              className="flex items-center space-x-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 border border-red-600 rounded-lg hover:bg-red-900/20 transition-colors"
            >
              <ArrowPathIcon className="w-4 h-4" />
              <span>Reset</span>
            </button>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-600 rounded-lg hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || isLoading}
              className="flex items-center space-x-2 px-4 py-2 text-sm bg-studiosix-600 text-white rounded-lg hover:bg-studiosix-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircleIcon className="w-4 h-4" />
              )}
              <span>Save Changes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// AI Chat Settings Tab
const ChatSettingsTab = ({ settings, providers, onChange }) => {
  const selectedProvider = providers[settings.provider];
  const availableModels = selectedProvider?.chatModels || [];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-white mb-4">AI Chat Configuration</h3>
        
        {/* Provider Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Provider</label>
            <select
              value={settings.provider}
              onChange={(e) => onChange('provider', e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-studiosix-500"
            >
              {Object.entries(providers).map(([key, provider]) => (
                provider.chatModels.length > 0 && (
                  <option key={key} value={key}>{provider.name}</option>
                )
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Model</label>
            <select
              value={settings.model}
              onChange={(e) => onChange('model', e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-studiosix-500"
            >
              {availableModels.map((model) => (
                <option key={model.id} value={model.id}>{model.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* System Prompt */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">System Prompt</label>
          <select
            value={settings.systemPrompt}
            onChange={(e) => onChange('systemPrompt', e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-studiosix-500 mb-2"
          >
            <option value="agent">Agent Mode (Fully Interactive)</option>
            <option value="ask">Ask Mode (Consultation Only)</option>
            <option value="custom">Custom Prompt</option>
          </select>
          
          {settings.systemPrompt === 'custom' && (
            <textarea
              value={settings.customSystemPrompt}
              onChange={(e) => onChange('customSystemPrompt', e.target.value)}
              placeholder="Enter your custom system prompt..."
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-studiosix-500 h-32 resize-none"
            />
          )}
        </div>

        {/* Advanced Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Temperature: {settings.temperature}
            </label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={settings.temperature}
              onChange={(e) => onChange('temperature', parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Precise</span>
              <span>Creative</span>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Max Tokens</label>
            <input
              type="number"
              value={settings.maxTokens}
              onChange={(e) => onChange('maxTokens', parseInt(e.target.value))}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-studiosix-500"
              min="1"
              max="8192"
            />
          </div>
        </div>

        {/* Feature Toggles */}
        <div className="space-y-3 mt-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.contextMemory}
              onChange={(e) => onChange('contextMemory', e.target.checked)}
              className="mr-3 rounded bg-gray-800 border-gray-600 text-studiosix-600 focus:ring-studiosix-500"
            />
            <span className="text-gray-300">Enable context memory</span>
          </label>
          
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.safetyFilters}
              onChange={(e) => onChange('safetyFilters', e.target.checked)}
              className="mr-3 rounded bg-gray-800 border-gray-600 text-studiosix-600 focus:ring-studiosix-500"
            />
            <span className="text-gray-300">Enable safety filters</span>
          </label>
        </div>
      </div>
    </div>
  );
};

// AI Render Settings Tab
const RenderSettingsTab = ({ settings, providers, onChange }) => {
  const selectedProvider = providers[settings.provider];
  const availableModels = selectedProvider?.renderModels || [];

  const presetOptions = [
    { value: 'photorealistic', label: 'Photorealistic' },
    { value: 'architectural', label: 'Architectural' },
    { value: 'concept', label: 'Concept Art' },
    { value: 'technical', label: 'Technical Drawing' }
  ];

  const resolutionOptions = [
    { value: '512x512', label: '512×512' },
    { value: '1024x1024', label: '1024×1024' },
    { value: '1024x768', label: '1024×768' },
    { value: '768x1024', label: '768×1024' },
    { value: '1536x1024', label: '1536×1024' },
    { value: '1024x1536', label: '1024×1536' }
  ];

  const qualityOptions = [
    { value: 'draft', label: 'Draft' },
    { value: 'standard', label: 'Standard' },
    { value: 'high', label: 'High' },
    { value: 'ultra', label: 'Ultra' }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-white mb-4">AI Render Configuration</h3>
        
        {/* Provider and Model */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Provider</label>
            <select
              value={settings.provider}
              onChange={(e) => onChange('provider', e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-studiosix-500"
            >
              {Object.entries(providers).map(([key, provider]) => (
                provider.renderModels.length > 0 && (
                  <option key={key} value={key}>{provider.name}</option>
                )
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Model</label>
            <select
              value={settings.model}
              onChange={(e) => onChange('model', e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-studiosix-500"
            >
              {availableModels.map((model) => (
                <option key={model.id} value={model.id}>{model.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Style and Quality */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Style Preset</label>
            <select
              value={settings.preset}
              onChange={(e) => onChange('preset', e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-studiosix-500"
            >
              {presetOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Quality</label>
            <select
              value={settings.quality}
              onChange={(e) => onChange('quality', e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-studiosix-500"
            >
              {qualityOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Resolution */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">Resolution</label>
          <select
            value={settings.resolution}
            onChange={(e) => onChange('resolution', e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-studiosix-500"
          >
            {resolutionOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        {/* Advanced Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Steps: {settings.steps}
            </label>
            <input
              type="range"
              min="10"
              max="50"
              step="1"
              value={settings.steps}
              onChange={(e) => onChange('steps', parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Fast</span>
              <span>Detailed</span>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Guidance: {settings.guidance}
            </label>
            <input
              type="range"
              min="1"
              max="20"
              step="0.5"
              value={settings.guidance}
              onChange={(e) => onChange('guidance', parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Creative</span>
              <span>Precise</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// API Keys Tab
const APIKeysTab = ({ settings, providers, showKeys, onToggleShowKeys, onChange }) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-white mb-4">API Key Configuration</h3>
        
        {/* BYOK Toggle */}
        <div className="mb-6 p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
          <label className="flex items-center justify-between">
            <div>
              <span className="text-white font-medium">Bring Your Own Key (BYOK)</span>
              <p className="text-gray-400 text-sm mt-1">Use your own API keys instead of the app's proxy service</p>
            </div>
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => onChange('enabled', e.target.checked)}
              className="ml-3 rounded bg-gray-800 border-gray-600 text-studiosix-600 focus:ring-studiosix-500"
            />
          </label>
          
          {settings.enabled && (
            <label className="flex items-center mt-3">
              <input
                type="checkbox"
                checked={settings.useAppFallback}
                onChange={(e) => onChange('useAppFallback', e.target.checked)}
                className="mr-3 rounded bg-gray-800 border-gray-600 text-studiosix-600 focus:ring-studiosix-500"
              />
              <span className="text-gray-300">Use app proxy as fallback if key fails</span>
            </label>
          )}
        </div>

        {/* Show/Hide Keys Toggle */}
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-white font-medium">API Keys</h4>
          <button
            onClick={onToggleShowKeys}
            className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-400 hover:text-white border border-gray-600 rounded-lg hover:bg-gray-800 transition-colors"
          >
            {showKeys ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
            <span>{showKeys ? 'Hide' : 'Show'} Keys</span>
          </button>
        </div>

        {/* API Key Inputs */}
        <div className="space-y-4">
          {Object.entries(providers).map(([key, provider]) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {provider.name} API Key
              </label>
              <input
                type={showKeys ? 'text' : 'password'}
                value={settings.apiKeys[key] || ''}
                onChange={(e) => onChange('apiKeys', { ...settings.apiKeys, [key]: e.target.value })}
                placeholder={`Enter your ${provider.name} API key...`}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-studiosix-500"
                disabled={!settings.enabled}
              />
            </div>
          ))}
        </div>

        {!settings.enabled && (
          <div className="mt-4 p-4 bg-blue-900/20 border border-blue-600 rounded-lg">
            <p className="text-blue-400 text-sm">
              BYOK is disabled. The app will use its proxy service for AI requests. 
              Enable BYOK to use your own API keys for potentially lower costs and higher rate limits.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// Enhanced Usage Tab with Subscription Integration
const UsageTab = ({ settings, usage, onChange }) => {
  const [subscription, setSubscription] = React.useState(null);
  const [tier, setTier] = React.useState(null);
  const [usageStats, setUsageStats] = React.useState(null);
  const [warnings, setWarnings] = React.useState([]);
  const [tokenUsage, setTokenUsage] = React.useState(null);

  // Load subscription data
  React.useEffect(() => {
    loadSubscriptionData();
    
    // Listen for subscription changes
    const unsubscribe = subscriptionService.onSubscriptionChange(() => {
      loadSubscriptionData();
    });
    
    return unsubscribe;
  }, []);

  const loadSubscriptionData = () => {
    try {
      const currentSubscription = subscriptionService.getSubscription();
      const currentTier = subscriptionService.getCurrentTier();
      const stats = subscriptionService.getUsageStats();
      const usageWarnings = tokenUsageService.getUsageWarnings();
      const tokenStats = tokenUsageService.getUsageStats();
      
      setSubscription(currentSubscription);
      setTier(currentTier);
      setUsageStats(stats);
      setWarnings(usageWarnings);
      setTokenUsage(tokenStats);
    } catch (error) {
      console.error('Failed to load subscription data:', error);
    }
  };

  const handleUpgrade = (targetTierId) => {
    try {
      subscriptionService.upgradeTo(targetTierId);
      alert(`Upgraded to ${subscriptionService.getCurrentTier().name}! 🎉`);
      loadSubscriptionData();
    } catch (error) {
      console.error('Upgrade failed:', error);
      alert('Upgrade failed. Please try again.');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 3
    }).format(amount);
  };

  if (!tier || !usageStats) {
    return <div className="text-white p-4">Loading subscription data...</div>;
  }

  const tiers = subscriptionService.getAllTiers();
  const currentTierId = tier.id;

  return (
    <div className="space-y-6">
      {/* Usage Alerts */}
      {warnings.length > 0 && (
        <div className="p-4 bg-yellow-900/20 border border-yellow-600 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <ExclamationTriangleIcon className="w-5 h-5 text-yellow-400" />
            <span className="text-yellow-400 font-medium">Usage Alerts</span>
          </div>
          {warnings.map((warning, index) => (
            <div key={index} className="text-sm text-yellow-300 mb-1">
              • {warning.message}
            </div>
          ))}
        </div>
      )}

      {/* Current Subscription */}
      <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium text-white">Current Plan</h3>
            <p className="text-studiosix-400 font-medium">{tier.name}</p>
            <p className="text-gray-400 text-sm">${tier.price}/{tier.period}</p>
          </div>
          {currentTierId === 'free' && (
            <button
              onClick={() => handleUpgrade('pro')}
              className="px-4 py-2 bg-studiosix-600 text-white rounded-lg hover:bg-studiosix-700 transition-colors text-sm"
            >
              Upgrade Now
            </button>
          )}
        </div>
      </div>

      {/* Monthly Usage Stats */}
      <div>
        <h3 className="text-lg font-medium text-white mb-4">Monthly Usage</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* AI Tokens */}
          <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-white font-medium">AI Tokens</h4>
              <span className="text-xs text-gray-400">
                {tier.limits.availableModels === 'all' ? 'All models' : tier.limits.availableModels?.join(', ')}
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Used</span>
                <span className="text-white">{usageStats.aiTokens.used.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Limit</span>
                <span className="text-white">{usageStats.aiTokens.limit.toLocaleString()}</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3">
                <div 
                  className={`h-3 rounded-full ${
                    usageStats.aiTokens.percentage > 90 ? 'bg-red-600' :
                    usageStats.aiTokens.percentage > 75 ? 'bg-yellow-600' : 'bg-studiosix-600'
                  }`}
                  style={{ width: `${Math.min(usageStats.aiTokens.percentage, 100)}%` }}
                ></div>
              </div>
              <div className="text-xs text-gray-400">
                {usageStats.aiTokens.percentage.toFixed(1)}% used
              </div>
            </div>
          </div>
          
          {/* Image Renders */}
          <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-white font-medium">Image Renders</h4>
              <span className="text-xs text-gray-400">
                Max: {tier.limits.maxImageResolution}
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Used</span>
                <span className="text-white">{usageStats.imageRenders.used}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Limit</span>
                <span className="text-white">
                  {usageStats.imageRenders.limit === -1 ? '∞' : usageStats.imageRenders.limit}
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3">
                <div 
                  className={`h-3 rounded-full ${
                    usageStats.imageRenders.percentage > 90 ? 'bg-red-600' :
                    usageStats.imageRenders.percentage > 75 ? 'bg-yellow-600' : 'bg-studiosix-600'
                  }`}
                  style={{ 
                    width: usageStats.imageRenders.limit === -1 ? '100%' : 
                           `${Math.min(usageStats.imageRenders.percentage, 100)}%` 
                  }}
                ></div>
              </div>
              <div className="text-xs text-gray-400">
                {usageStats.imageRenders.limit === -1 ? 'Unlimited' : 
                 `${usageStats.imageRenders.percentage.toFixed(1)}% used`}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cost Tracking */}
      {tokenUsage && (
        <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
          <h4 className="text-white font-medium mb-3">Cost Tracking</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-lg font-bold text-studiosix-400">
                {formatCurrency(tokenUsage.currentMonth.totalCost)}
              </div>
              <div className="text-xs text-gray-400">This Month</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-studiosix-400">
                {formatCurrency(tokenUsage.today.totalCost)}
              </div>
              <div className="text-xs text-gray-400">Today</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-studiosix-400">
                {formatCurrency(tokenUsage.lifetime.totalCost)}
              </div>
              <div className="text-xs text-gray-400">All Time</div>
            </div>
          </div>
        </div>
      )}

      {/* Plan Comparison */}
      {currentTierId === 'free' && (
        <div className="space-y-4">
          <h4 className="text-white font-medium">Upgrade Options</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(tiers).slice(1).map(([tierId, tierData]) => ( // Skip free tier
              <div
                key={tierId}
                className="p-4 border border-gray-700 rounded-lg bg-gray-800/30 hover:border-studiosix-500 transition-colors"
              >
                <div className="text-center">
                  <h5 className="font-medium text-white mb-1">{tierData.name}</h5>
                  <div className="text-2xl font-bold text-studiosix-400 mb-2">
                    ${tierData.price}<span className="text-sm text-gray-400">/mo</span>
                  </div>
                  <div className="space-y-1 mb-4 text-xs text-gray-300">
                    <div>{tierData.limits.aiTokensPerMonth.toLocaleString()} tokens</div>
                    <div>
                      {tierData.limits.imageRendersPerMonth === -1 
                        ? 'Unlimited renders' 
                        : `${tierData.limits.imageRendersPerMonth} renders`
                      }
                    </div>
                    <div>Up to {tierData.limits.maxImageResolution}</div>
                  </div>
                  <button
                    onClick={() => handleUpgrade(tierId)}
                    className="w-full px-3 py-2 bg-studiosix-600 text-white rounded-lg hover:bg-studiosix-700 transition-colors text-sm"
                  >
                    Upgrade
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legacy Settings (kept for compatibility) */}
      <div className="pt-6 border-t border-gray-700">
        <h4 className="text-white font-medium mb-4">Legacy Settings</h4>
        <div className="text-sm text-gray-400 mb-4">
          These settings are now managed by your subscription plan. 
          {currentTierId === 'free' && ' Upgrade for more control and higher limits.'}
        </div>
        
        {/* Session tracking still available */}
        <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
          <h5 className="text-white font-medium mb-2">Session Usage</h5>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-xl font-bold text-studiosix-400">
                {tokenUsage?.session?.aiTokens || 0}
              </div>
              <div className="text-xs text-gray-400">AI Tokens</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-studiosix-400">
                {tokenUsage?.session?.imageRenders || 0}
              </div>
              <div className="text-xs text-gray-400">Image Renders</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Privacy Tab
const PrivacyTab = ({ settings, onChange }) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-white mb-4">Privacy & Data Settings</h3>
        
        <div className="space-y-4">
          <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
            <label className="flex items-center justify-between">
              <div>
                <span className="text-white font-medium">Send Analytics</span>
                <p className="text-gray-400 text-sm mt-1">Share anonymous usage analytics to help improve the app</p>
              </div>
              <input
                type="checkbox"
                checked={settings.sendAnalytics}
                onChange={(e) => onChange('sendAnalytics', e.target.checked)}
                className="ml-3 rounded bg-gray-800 border-gray-600 text-studiosix-600 focus:ring-studiosix-500"
              />
            </label>
          </div>
          
          <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
            <label className="flex items-center justify-between">
              <div>
                <span className="text-white font-medium">Store Chat History</span>
                <p className="text-gray-400 text-sm mt-1">Keep chat conversations locally for context memory</p>
              </div>
              <input
                type="checkbox"
                checked={settings.storeChatHistory}
                onChange={(e) => onChange('storeChatHistory', e.target.checked)}
                className="ml-3 rounded bg-gray-800 border-gray-600 text-studiosix-600 focus:ring-studiosix-500"
              />
            </label>
          </div>
          
          <div className="p-4 bg-red-900/20 border border-red-600 rounded-lg">
            <label className="flex items-center justify-between">
              <div>
                <span className="text-white font-medium">Allow Training Data</span>
                <p className="text-red-400 text-sm mt-1">Allow AI providers to use your data for training (NOT RECOMMENDED)</p>
              </div>
              <input
                type="checkbox"
                checked={settings.allowTraining}
                onChange={(e) => onChange('allowTraining', e.target.checked)}
                className="ml-3 rounded bg-gray-800 border-gray-600 text-red-600 focus:ring-red-500"
              />
            </label>
          </div>
          
          <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
            <label className="flex items-center justify-between">
              <div>
                <span className="text-white font-medium">Share Usage Data</span>
                <p className="text-gray-400 text-sm mt-1">Share anonymized usage patterns for research</p>
              </div>
              <input
                type="checkbox"
                checked={settings.shareUsageData}
                onChange={(e) => onChange('shareUsageData', e.target.checked)}
                className="ml-3 rounded bg-gray-800 border-gray-600 text-studiosix-600 focus:ring-studiosix-500"
              />
            </label>
          </div>
        </div>
        
        <div className="mt-6 p-4 bg-blue-900/20 border border-blue-600 rounded-lg">
          <h4 className="text-blue-400 font-medium mb-2">Privacy Information</h4>
          <ul className="text-blue-400 text-sm space-y-1">
            <li>• All settings are stored locally on your device</li>
            <li>• API keys are never transmitted to our servers</li>
            <li>• Chat history is kept locally unless you opt to share</li>
            <li>• You can export or delete your data at any time</li>
            <li>• Settings are user-specific when authenticated</li>
            <li>• Anonymous settings migrate to your account on login</li>
          </ul>
        </div>
        
        {/* Debug Info for Development */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
            <h4 className="text-gray-400 font-medium mb-2">Debug Info (Dev Only)</h4>
            <div className="text-xs text-gray-500 space-y-1">
              <div>Storage Key: {aiSettingsService.getSettingsInfo().storageKey}</div>
              <div>Usage Key: {aiSettingsService.getSettingsInfo().usageStorageKey}</div>
              <div>Authenticated: {aiSettingsService.isAuthenticated() ? 'Yes' : 'No'}</div>
              <div>User ID: {aiSettingsService.getCurrentUserId() || 'Anonymous'}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AISettingsModal;