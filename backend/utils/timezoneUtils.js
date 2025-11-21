/**
 * Country to Timezone Mapping Utility
 * Maps ISO 3166-1 alpha-2 country codes to IANA timezone strings
 */

// Comprehensive country to primary timezone mapping
const countryToTimezone = {
  // North America
  'US': 'America/New_York',        // USA (Eastern)
  'CA': 'America/Toronto',         // Canada (Eastern)
  'MX': 'America/Mexico_City',     // Mexico

  // Central America & Caribbean
  'GT': 'America/Guatemala',       // Guatemala
  'BZ': 'America/Belize',          // Belize
  'SV': 'America/El_Salvador',     // El Salvador
  'HN': 'America/Tegucigalpa',     // Honduras
  'NI': 'America/Managua',         // Nicaragua
  'CR': 'America/Costa_Rica',      // Costa Rica
  'PA': 'America/Panama',          // Panama
  'CU': 'America/Havana',          // Cuba
  'JM': 'America/Jamaica',         // Jamaica
  'HT': 'America/Port-au-Prince',  // Haiti
  'DO': 'America/Santo_Domingo',   // Dominican Republic
  'PR': 'America/Puerto_Rico',     // Puerto Rico
  'TT': 'America/Port_of_Spain',   // Trinidad and Tobago

  // South America
  'BR': 'America/Sao_Paulo',       // Brazil
  'AR': 'America/Argentina/Buenos_Aires', // Argentina
  'CL': 'America/Santiago',        // Chile
  'CO': 'America/Bogota',          // Colombia
  'PE': 'America/Lima',            // Peru
  'VE': 'America/Caracas',         // Venezuela
  'EC': 'America/Guayaquil',       // Ecuador
  'BO': 'America/La_Paz',          // Bolivia
  'PY': 'America/Asuncion',        // Paraguay
  'UY': 'America/Montevideo',      // Uruguay
  'GY': 'America/Guyana',          // Guyana
  'SR': 'America/Paramaribo',      // Suriname
  'GF': 'America/Cayenne',         // French Guiana

  // Europe
  'GB': 'Europe/London',           // United Kingdom
  'IE': 'Europe/Dublin',           // Ireland
  'FR': 'Europe/Paris',            // France
  'DE': 'Europe/Berlin',           // Germany
  'IT': 'Europe/Rome',             // Italy
  'ES': 'Europe/Madrid',           // Spain
  'PT': 'Europe/Lisbon',           // Portugal
  'NL': 'Europe/Amsterdam',        // Netherlands
  'BE': 'Europe/Brussels',         // Belgium
  'CH': 'Europe/Zurich',           // Switzerland
  'AT': 'Europe/Vienna',           // Austria
  'SE': 'Europe/Stockholm',        // Sweden
  'NO': 'Europe/Oslo',             // Norway
  'DK': 'Europe/Copenhagen',       // Denmark
  'FI': 'Europe/Helsinki',         // Finland
  'PL': 'Europe/Warsaw',           // Poland
  'CZ': 'Europe/Prague',           // Czech Republic
  'HU': 'Europe/Budapest',         // Hungary
  'RO': 'Europe/Bucharest',        // Romania
  'GR': 'Europe/Athens',           // Greece
  'BG': 'Europe/Sofia',            // Bulgaria
  'RS': 'Europe/Belgrade',         // Serbia
  'HR': 'Europe/Zagreb',           // Croatia
  'SI': 'Europe/Ljubljana',        // Slovenia
  'SK': 'Europe/Bratislava',       // Slovakia
  'UA': 'Europe/Kiev',             // Ukraine
  'RU': 'Europe/Moscow',           // Russia (Moscow)
  'TR': 'Europe/Istanbul',         // Turkey

  // Asia
  'CN': 'Asia/Shanghai',           // China
  'JP': 'Asia/Tokyo',              // Japan
  'KR': 'Asia/Seoul',              // South Korea
  'IN': 'Asia/Kolkata',            // India
  'PK': 'Asia/Karachi',            // Pakistan
  'BD': 'Asia/Dhaka',              // Bangladesh
  'TH': 'Asia/Bangkok',            // Thailand
  'VN': 'Asia/Ho_Chi_Minh',        // Vietnam
  'PH': 'Asia/Manila',             // Philippines
  'ID': 'Asia/Jakarta',            // Indonesia
  'MY': 'Asia/Kuala_Lumpur',       // Malaysia
  'SG': 'Asia/Singapore',          // Singapore
  'HK': 'Asia/Hong_Kong',          // Hong Kong
  'TW': 'Asia/Taipei',             // Taiwan
  'KH': 'Asia/Phnom_Penh',         // Cambodia
  'LA': 'Asia/Vientiane',          // Laos
  'MM': 'Asia/Yangon',             // Myanmar
  'NP': 'Asia/Kathmandu',          // Nepal
  'LK': 'Asia/Colombo',            // Sri Lanka
  'AF': 'Asia/Kabul',              // Afghanistan
  'IQ': 'Asia/Baghdad',            // Iraq
  'IR': 'Asia/Tehran',             // Iran
  'IL': 'Asia/Jerusalem',          // Israel
  'SA': 'Asia/Riyadh',             // Saudi Arabia
  'AE': 'Asia/Dubai',              // United Arab Emirates
  'QA': 'Asia/Qatar',              // Qatar
  'KW': 'Asia/Kuwait',             // Kuwait
  'OM': 'Asia/Muscat',             // Oman
  'JO': 'Asia/Amman',              // Jordan
  'LB': 'Asia/Beirut',             // Lebanon
  'SY': 'Asia/Damascus',           // Syria

  // Africa
  'EG': 'Africa/Cairo',            // Egypt
  'ZA': 'Africa/Johannesburg',     // South Africa
  'NG': 'Africa/Lagos',            // Nigeria
  'KE': 'Africa/Nairobi',          // Kenya
  'GH': 'Africa/Accra',            // Ghana
  'ET': 'Africa/Addis_Ababa',      // Ethiopia
  'TZ': 'Africa/Dar_es_Salaam',    // Tanzania
  'UG': 'Africa/Kampala',          // Uganda
  'MA': 'Africa/Casablanca',       // Morocco
  'DZ': 'Africa/Algiers',          // Algeria
  'TN': 'Africa/Tunis',            // Tunisia
  'LY': 'Africa/Tripoli',          // Libya
  'SD': 'Africa/Khartoum',         // Sudan
  'SN': 'Africa/Dakar',            // Senegal
  'CI': 'Africa/Abidjan',          // Ivory Coast
  'CM': 'Africa/Douala',           // Cameroon
  'ZW': 'Africa/Harare',           // Zimbabwe
  'ZM': 'Africa/Lusaka',           // Zambia
  'MW': 'Africa/Blantyre',         // Malawi
  'MZ': 'Africa/Maputo',           // Mozambique
  'AO': 'Africa/Luanda',           // Angola
  'BW': 'Africa/Gaborone',         // Botswana
  'NA': 'Africa/Windhoek',         // Namibia

  // Oceania
  'AU': 'Australia/Sydney',        // Australia (Eastern)
  'NZ': 'Pacific/Auckland',        // New Zealand
  'FJ': 'Pacific/Fiji',            // Fiji
  'PG': 'Pacific/Port_Moresby',    // Papua New Guinea
  'NC': 'Pacific/Noumea',          // New Caledonia
  'WS': 'Pacific/Apia',            // Samoa
  'TO': 'Pacific/Tongatapu',       // Tonga
  'VU': 'Pacific/Efate',           // Vanuatu
  'SB': 'Pacific/Guadalcanal',     // Solomon Islands
};

// Multiple timezone support for countries spanning multiple zones
const countryTimezones = {
  'US': [
    'America/New_York',      // Eastern
    'America/Chicago',       // Central
    'America/Denver',        // Mountain
    'America/Los_Angeles',   // Pacific
    'America/Anchorage',     // Alaska
    'Pacific/Honolulu',      // Hawaii
  ],
  'CA': [
    'America/St_Johns',      // Newfoundland
    'America/Halifax',       // Atlantic
    'America/Toronto',       // Eastern
    'America/Winnipeg',      // Central
    'America/Edmonton',      // Mountain
    'America/Vancouver',     // Pacific
  ],
  'BR': [
    'America/Noronha',       // Fernando de Noronha
    'America/Belem',         // Brasília (part)
    'America/Sao_Paulo',     // Brasília
    'America/Manaus',        // Amazon
    'America/Rio_Branco',    // Acre
  ],
  'RU': [
    'Europe/Kaliningrad',    // Kaliningrad
    'Europe/Moscow',         // Moscow
    'Europe/Samara',         // Samara
    'Asia/Yekaterinburg',    // Yekaterinburg
    'Asia/Omsk',             // Omsk
    'Asia/Krasnoyarsk',      // Krasnoyarsk
    'Asia/Irkutsk',          // Irkutsk
    'Asia/Yakutsk',          // Yakutsk
    'Asia/Vladivostok',      // Vladivostok
    'Asia/Magadan',          // Magadan
    'Asia/Kamchatka',        // Kamchatka
  ],
  'AU': [
    'Australia/Perth',       // Western
    'Australia/Darwin',      // Northern
    'Australia/Adelaide',    // Central
    'Australia/Sydney',      // Eastern
    'Australia/Brisbane',    // Queensland
    'Australia/Hobart',      // Tasmania
  ],
  'MX': [
    'America/Tijuana',       // Pacific
    'America/Hermosillo',    // Mountain (no DST)
    'America/Chihuahua',     // Mountain
    'America/Mexico_City',   // Central
    'America/Cancun',        // Eastern
  ],
};

/**
 * Get the primary timezone for a country
 * @param {string} countryCode - ISO 3166-1 alpha-2 country code (e.g., 'US', 'GB')
 * @returns {string|null} - IANA timezone string or null if not found
 */
function getTimezoneFromCountry(countryCode) {
  if (!countryCode) {
    return null;
  }

  const upperCode = countryCode.toUpperCase();
  return countryToTimezone[upperCode] || null;
}

/**
 * Get all timezones for a country (for countries with multiple zones)
 * @param {string} countryCode - ISO 3166-1 alpha-2 country code
 * @returns {string[]} - Array of IANA timezone strings
 */
function getAllTimezonesForCountry(countryCode) {
  if (!countryCode) {
    return [];
  }

  const upperCode = countryCode.toUpperCase();

  // Return multiple timezones if available
  if (countryTimezones[upperCode]) {
    return countryTimezones[upperCode];
  }

  // Otherwise return single timezone as array
  const singleTimezone = countryToTimezone[upperCode];
  return singleTimezone ? [singleTimezone] : [];
}

/**
 * Get timezone offset in minutes from UTC for a given timezone
 * @param {string} timezone - IANA timezone string
 * @returns {number} - Offset in minutes from UTC
 */
function getTimezoneOffset(timezone) {
  try {
    const now = new Date();
    const tzDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    return (tzDate.getTime() - utcDate.getTime()) / (1000 * 60);
  } catch (error) {
    console.error(`Error calculating offset for timezone ${timezone}:`, error);
    return 0;
  }
}

/**
 * Validate if a timezone string is valid IANA timezone
 * @param {string} timezone - IANA timezone string to validate
 * @returns {boolean} - True if valid, false otherwise
 */
function isValidTimezone(timezone) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get formatted timezone display name
 * @param {string} timezone - IANA timezone string
 * @returns {string} - Formatted display name (e.g., "America/New_York (UTC-5)")
 */
function getTimezoneDisplayName(timezone) {
  if (!timezone) return '';

  try {
    const offset = getTimezoneOffset(timezone);
    const hours = Math.floor(Math.abs(offset) / 60);
    const minutes = Math.abs(offset) % 60;
    const sign = offset >= 0 ? '+' : '-';
    const offsetStr = `UTC${sign}${hours}${minutes > 0 ? ':' + minutes : ''}`;

    return `${timezone} (${offsetStr})`;
  } catch (error) {
    return timezone;
  }
}

/**
 * Get list of all supported countries with their timezones
 * @returns {Array<{code: string, timezone: string}>} - Array of country-timezone pairs
 */
function getSupportedCountries() {
  return Object.entries(countryToTimezone).map(([code, timezone]) => ({
    code,
    timezone,
    hasMultipleZones: !!countryTimezones[code],
  }));
}

module.exports = {
  getTimezoneFromCountry,
  getAllTimezonesForCountry,
  getTimezoneOffset,
  isValidTimezone,
  getTimezoneDisplayName,
  getSupportedCountries,
  countryToTimezone,
  countryTimezones,
};
