/**
 * SettingsContext — Hotel configuration and East Africa localization.
 *
 * Provides:
 *   settings        — Hotel name, tagline, currency, country, logo, etc.
 *   formatCurrency  — Formats amounts in the active currency (KES/RWF/TZS/etc.)
 *   getPaymentMethods — Returns payment methods for the selected country
 *   getPaymentLabel — Converts method code to display label
 *   countries       — East African countries with phone codes
 *   nationalities   — Common nationalities for guest registration
 *   currencies      — Supported EA currencies with locale info
 *
 * Payment methods auto-switch by country:
 *   Kenya → M-Pesa, Rwanda → MTN MoMo, Ethiopia → Telebirr, etc.
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const SettingsContext = createContext(null);

const EA_CURRENCIES = {
  KES: { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', locale: 'en-KE' },
  TZS: { code: 'TZS', name: 'Tanzanian Shilling', symbol: 'TSh', locale: 'en-TZ' },
  UGX: { code: 'UGX', name: 'Ugandan Shilling', symbol: 'USh', locale: 'en-UG' },
  RWF: { code: 'RWF', name: 'Rwandan Franc', symbol: 'FRw', locale: 'en-RW' },
  BIF: { code: 'BIF', name: 'Burundian Franc', symbol: 'FBu', locale: 'fr-BI' },
  SSP: { code: 'SSP', name: 'South Sudanese Pound', symbol: 'SSP', locale: 'en-SS' },
  ETB: { code: 'ETB', name: 'Ethiopian Birr', symbol: 'Br', locale: 'en-ET' },
  USD: { code: 'USD', name: 'US Dollar', symbol: '$', locale: 'en-US' },
};

const EA_COUNTRIES = [
  { name: 'Kenya', code: 'KE', phone: '+254', currency: 'KES' },
  { name: 'Tanzania', code: 'TZ', phone: '+255', currency: 'TZS' },
  { name: 'Uganda', code: 'UG', phone: '+256', currency: 'UGX' },
  { name: 'Rwanda', code: 'RW', phone: '+250', currency: 'RWF' },
  { name: 'Burundi', code: 'BI', phone: '+257', currency: 'BIF' },
  { name: 'South Sudan', code: 'SS', phone: '+211', currency: 'SSP' },
  { name: 'Ethiopia', code: 'ET', phone: '+251', currency: 'ETB' },
  { name: 'DR Congo', code: 'CD', phone: '+243', currency: 'CDF' },
  { name: 'Somalia', code: 'SO', phone: '+252', currency: 'SOS' },
  { name: 'Eritrea', code: 'ER', phone: '+291', currency: 'ERN' },
];

const EA_NATIONALITIES = [
  'Kenyan', 'Tanzanian', 'Ugandan', 'Rwandan', 'Burundian',
  'South Sudanese', 'Ethiopian', 'Congolese', 'Somali', 'Eritrean',
  'Nigerian', 'South African', 'British', 'American', 'Indian',
  'Chinese', 'German', 'French', 'Canadian', 'Australian',
];

const COUNTRY_PAYMENT_METHODS = {
  Kenya:        [{ value: 'cash', label: 'Cash' }, { value: 'mpesa', label: 'M-Pesa' }, { value: 'card', label: 'Credit/Debit Card' }, { value: 'bank_transfer', label: 'Bank Transfer' }, { value: 'airtel_money', label: 'Airtel Money' }],
  Tanzania:     [{ value: 'cash', label: 'Cash' }, { value: 'mpesa', label: 'M-Pesa' }, { value: 'tigopesa', label: 'Tigo Pesa' }, { value: 'airtel_money', label: 'Airtel Money' }, { value: 'card', label: 'Credit/Debit Card' }, { value: 'bank_transfer', label: 'Bank Transfer' }],
  Uganda:       [{ value: 'cash', label: 'Cash' }, { value: 'mtn_momo', label: 'MTN Mobile Money' }, { value: 'airtel_money', label: 'Airtel Money' }, { value: 'card', label: 'Credit/Debit Card' }, { value: 'bank_transfer', label: 'Bank Transfer' }],
  Rwanda:       [{ value: 'cash', label: 'Cash' }, { value: 'mtn_momo', label: 'MTN Mobile Money' }, { value: 'airtel_money', label: 'Airtel Money' }, { value: 'card', label: 'Credit/Debit Card' }, { value: 'bank_transfer', label: 'Bank Transfer' }],
  Burundi:      [{ value: 'cash', label: 'Cash' }, { value: 'lumicash', label: 'Lumicash' }, { value: 'ecocash', label: 'Ecocash' }, { value: 'card', label: 'Credit/Debit Card' }, { value: 'bank_transfer', label: 'Bank Transfer' }],
  'South Sudan':[{ value: 'cash', label: 'Cash' }, { value: 'mtn_momo', label: 'MTN Mobile Money' }, { value: 'card', label: 'Credit/Debit Card' }, { value: 'bank_transfer', label: 'Bank Transfer' }],
  Ethiopia:     [{ value: 'cash', label: 'Cash' }, { value: 'telebirr', label: 'Telebirr' }, { value: 'cbe_birr', label: 'CBE Birr' }, { value: 'card', label: 'Credit/Debit Card' }, { value: 'bank_transfer', label: 'Bank Transfer' }],
  'DR Congo':   [{ value: 'cash', label: 'Cash' }, { value: 'mpesa', label: 'M-Pesa' }, { value: 'airtel_money', label: 'Airtel Money' }, { value: 'orange_money', label: 'Orange Money' }, { value: 'card', label: 'Credit/Debit Card' }, { value: 'bank_transfer', label: 'Bank Transfer' }],
  Somalia:      [{ value: 'cash', label: 'Cash' }, { value: 'evc_plus', label: 'EVC Plus (Hormuud)' }, { value: 'zaad', label: 'Zaad (Telesom)' }, { value: 'sahal', label: 'Sahal (Golis)' }, { value: 'bank_transfer', label: 'Bank Transfer' }],
  _default:     [{ value: 'cash', label: 'Cash' }, { value: 'mobile_money', label: 'Mobile Money' }, { value: 'card', label: 'Credit/Debit Card' }, { value: 'bank_transfer', label: 'Bank Transfer' }],
};

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    const cached = localStorage.getItem('hotel_settings');
    if (cached) {
      try { return JSON.parse(cached); } catch (e) {}
    }
    return {
      hotel_name: 'Terrassa Village',
      hotel_tagline: 'Hotel & Resort',
      currency: 'RWF',
      country: 'Rwanda',
    };
  });
  const [loaded, setLoaded] = useState(false);

  const loadSettings = () => {
    const token = localStorage.getItem('token');
    if (token) {
      api.getSettings().then(s => {
        setSettings(s);
        localStorage.setItem('hotel_settings', JSON.stringify(s));
        setLoaded(true);
      }).catch(() => setLoaded(true));
    } else {
      setLoaded(true);
    }
  };

  useEffect(() => { loadSettings(); }, []);

  useEffect(() => {
    document.title = `${settings.hotel_name || 'Hotel'} — Front Office`;
  }, [settings.hotel_name]);

  useEffect(() => {
    const onLogin = () => loadSettings();
    window.addEventListener('auth-login', onLogin);
    return () => window.removeEventListener('auth-login', onLogin);
  }, []);

  const updateSettings = async (newSettings) => {
    const result = await api.updateSettings(newSettings);
    setSettings(result);
    localStorage.setItem('hotel_settings', JSON.stringify(result));
    return result;
  };

  const refreshSettings = async () => {
    try {
      const s = await api.getSettings();
      setSettings(s);
      localStorage.setItem('hotel_settings', JSON.stringify(s));
    } catch (e) {}
  };

  const formatCurrency = (amount) => {
    const curr = EA_CURRENCIES[settings.currency] || EA_CURRENCIES.KES;
    try {
      return new Intl.NumberFormat(curr.locale, {
        style: 'currency', currency: curr.code, minimumFractionDigits: 0,
      }).format(amount);
    } catch {
      return `${curr.symbol} ${Number(amount).toLocaleString()}`;
    }
  };

  const getPaymentMethods = () => {
    return COUNTRY_PAYMENT_METHODS[settings.country] || COUNTRY_PAYMENT_METHODS._default;
  };

  const getPaymentLabel = (value) => {
    const methods = getPaymentMethods();
    const m = methods.find(m => m.value === value);
    if (m) return m.label;
    const allMethods = Object.values(COUNTRY_PAYMENT_METHODS).flat();
    const found = allMethods.find(m => m.value === value);
    return found ? found.label : value?.replace('_', ' ') || value;
  };

  return (
    <SettingsContext.Provider value={{
      settings, updateSettings, refreshSettings, formatCurrency, loaded,
      currencies: EA_CURRENCIES, countries: EA_COUNTRIES, nationalities: EA_NATIONALITIES,
      getPaymentMethods, getPaymentLabel,
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within SettingsProvider');
  return context;
}
