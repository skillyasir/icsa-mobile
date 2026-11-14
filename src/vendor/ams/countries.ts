// @ts-nocheck
// VENDORED from the AMS — client/src/utils/countries.js, VERBATIM below the marker.
// The one country dataset: nationality and country of residence are stored as
// these exact strings, so the app must offer the website's own. money.check.ts
// holds everything below the marker byte-identical to the AMS copy on the Mac;
// to update it, copy the AMS file again — never edit it here.
// ── verbatim below ──
// countries.js — the single country dataset for the whole client.
//
// Before this file there were three forks of the same data: COUNTRIES and
// NATIONALITIES in utils/constants.js (parallel lists with no key joining
// them), COUNTRY_CODES in components/ui/CountryCodeSelect.js (6 GCC entries
// with dial codes), and CAP_COUNTRIES inside pages/cap/CapCatalog.js. This is
// now the source; constants.js and CountryCodeSelect.js derive from it.
//
// INVARIANT: `name` and `demonym` must keep matching, byte for byte, every
// string that was already in COUNTRIES / NATIONALITIES. Those values are
// stored raw in students.country_of_residence / students.nationality, and
// StudentProfile.js renders them in a plain <Select> — a renamed string makes
// a saved student's field silently render blank. Hence "UAE" not "United Arab
// Emirates", "Czech Republic" not "Czechia", and "Myanmar" as its own demonym.
// client/src/lib/__checks__ asserts the superset property.
//
// `dial` is the international prefix WITHOUT the leading "+", matching how the
// backend's normalizePhone() strips it.

export const COUNTRY_DATA = [
  { code: 'AF', name: 'Afghanistan', demonym: 'Afghan', dial: '93' },
  { code: 'AL', name: 'Albania', demonym: 'Albanian', dial: '355' },
  { code: 'DZ', name: 'Algeria', demonym: 'Algerian', dial: '213' },
  { code: 'AD', name: 'Andorra', demonym: 'Andorran', dial: '376' },
  { code: 'AO', name: 'Angola', demonym: 'Angolan', dial: '244' },
  { code: 'AG', name: 'Antigua and Barbuda', demonym: 'Antiguan', dial: '1268' },
  { code: 'AR', name: 'Argentina', demonym: 'Argentine', dial: '54' },
  { code: 'AM', name: 'Armenia', demonym: 'Armenian', dial: '374' },
  { code: 'AU', name: 'Australia', demonym: 'Australian', dial: '61' },
  { code: 'AT', name: 'Austria', demonym: 'Austrian', dial: '43' },
  { code: 'AZ', name: 'Azerbaijan', demonym: 'Azerbaijani', dial: '994' },
  { code: 'BS', name: 'Bahamas', demonym: 'Bahamian', dial: '1242' },
  { code: 'BH', name: 'Bahrain', demonym: 'Bahraini', dial: '973' },
  { code: 'BD', name: 'Bangladesh', demonym: 'Bangladeshi', dial: '880' },
  { code: 'BB', name: 'Barbados', demonym: 'Barbadian', dial: '1246' },
  { code: 'BY', name: 'Belarus', demonym: 'Belarusian', dial: '375' },
  { code: 'BE', name: 'Belgium', demonym: 'Belgian', dial: '32' },
  { code: 'BZ', name: 'Belize', demonym: 'Belizean', dial: '501' },
  { code: 'BJ', name: 'Benin', demonym: 'Beninese', dial: '229' },
  { code: 'BT', name: 'Bhutan', demonym: 'Bhutanese', dial: '975' },
  { code: 'BO', name: 'Bolivia', demonym: 'Bolivian', dial: '591' },
  { code: 'BA', name: 'Bosnia and Herzegovina', demonym: 'Bosnian', dial: '387' },
  { code: 'BW', name: 'Botswana', demonym: 'Motswana', dial: '267' },
  { code: 'BR', name: 'Brazil', demonym: 'Brazilian', dial: '55' },
  { code: 'BN', name: 'Brunei', demonym: 'Bruneian', dial: '673' },
  { code: 'BG', name: 'Bulgaria', demonym: 'Bulgarian', dial: '359' },
  { code: 'BF', name: 'Burkina Faso', demonym: 'Burkinabe', dial: '226' },
  { code: 'BI', name: 'Burundi', demonym: 'Burundian', dial: '257' },
  { code: 'KH', name: 'Cambodia', demonym: 'Cambodian', dial: '855' },
  { code: 'CM', name: 'Cameroon', demonym: 'Cameroonian', dial: '237' },
  { code: 'CA', name: 'Canada', demonym: 'Canadian', dial: '1' },
  { code: 'CV', name: 'Cape Verde', demonym: 'Cape Verdean', dial: '238' },
  { code: 'CF', name: 'Central African Republic', demonym: 'Central African', dial: '236' },
  { code: 'TD', name: 'Chad', demonym: 'Chadian', dial: '235' },
  { code: 'CL', name: 'Chile', demonym: 'Chilean', dial: '56' },
  { code: 'CN', name: 'China', demonym: 'Chinese', dial: '86' },
  { code: 'CO', name: 'Colombia', demonym: 'Colombian', dial: '57' },
  { code: 'KM', name: 'Comoros', demonym: 'Comoran', dial: '269' },
  { code: 'CG', name: 'Congo', demonym: 'Congolese', dial: '242' },
  { code: 'CD', name: 'Congo (DRC)', demonym: 'Congolese (DRC)', dial: '243' },
  { code: 'CR', name: 'Costa Rica', demonym: 'Costa Rican', dial: '506' },
  { code: 'CI', name: "Cote d'Ivoire", demonym: 'Ivorian', dial: '225' },
  { code: 'HR', name: 'Croatia', demonym: 'Croatian', dial: '385' },
  { code: 'CU', name: 'Cuba', demonym: 'Cuban', dial: '53' },
  { code: 'CY', name: 'Cyprus', demonym: 'Cypriot', dial: '357' },
  { code: 'CZ', name: 'Czech Republic', demonym: 'Czech', dial: '420' },
  { code: 'DK', name: 'Denmark', demonym: 'Danish', dial: '45' },
  { code: 'DJ', name: 'Djibouti', demonym: 'Djiboutian', dial: '253' },
  { code: 'DM', name: 'Dominica', demonym: 'Dominican', dial: '1767' },
  { code: 'DO', name: 'Dominican Republic', demonym: 'Dominican Republic', dial: '1809' },
  { code: 'EC', name: 'Ecuador', demonym: 'Ecuadorian', dial: '593' },
  { code: 'EG', name: 'Egypt', demonym: 'Egyptian', dial: '20' },
  { code: 'SV', name: 'El Salvador', demonym: 'Salvadoran', dial: '503' },
  { code: 'GQ', name: 'Equatorial Guinea', demonym: 'Equatorial Guinean', dial: '240' },
  { code: 'ER', name: 'Eritrea', demonym: 'Eritrean', dial: '291' },
  { code: 'EE', name: 'Estonia', demonym: 'Estonian', dial: '372' },
  { code: 'SZ', name: 'Eswatini', demonym: 'Swazi', dial: '268' },
  { code: 'ET', name: 'Ethiopia', demonym: 'Ethiopian', dial: '251' },
  { code: 'FJ', name: 'Fiji', demonym: 'Fijian', dial: '679' },
  { code: 'FI', name: 'Finland', demonym: 'Finnish', dial: '358' },
  { code: 'FR', name: 'France', demonym: 'French', dial: '33' },
  { code: 'GA', name: 'Gabon', demonym: 'Gabonese', dial: '241' },
  { code: 'GM', name: 'Gambia', demonym: 'Gambian', dial: '220' },
  { code: 'GE', name: 'Georgia', demonym: 'Georgian', dial: '995' },
  { code: 'DE', name: 'Germany', demonym: 'German', dial: '49' },
  { code: 'GH', name: 'Ghana', demonym: 'Ghanaian', dial: '233' },
  { code: 'GR', name: 'Greece', demonym: 'Greek', dial: '30' },
  { code: 'GD', name: 'Grenada', demonym: 'Grenadian', dial: '1473' },
  { code: 'GT', name: 'Guatemala', demonym: 'Guatemalan', dial: '502' },
  { code: 'GN', name: 'Guinea', demonym: 'Guinean', dial: '224' },
  { code: 'GW', name: 'Guinea-Bissau', demonym: 'Bissau-Guinean', dial: '245' },
  { code: 'GY', name: 'Guyana', demonym: 'Guyanese', dial: '592' },
  { code: 'HT', name: 'Haiti', demonym: 'Haitian', dial: '509' },
  { code: 'HN', name: 'Honduras', demonym: 'Honduran', dial: '504' },
  { code: 'HK', name: 'Hong Kong', demonym: 'Hong Konger', dial: '852' },
  { code: 'HU', name: 'Hungary', demonym: 'Hungarian', dial: '36' },
  { code: 'IS', name: 'Iceland', demonym: 'Icelandic', dial: '354' },
  { code: 'IN', name: 'India', demonym: 'Indian', dial: '91' },
  { code: 'ID', name: 'Indonesia', demonym: 'Indonesian', dial: '62' },
  { code: 'IR', name: 'Iran', demonym: 'Iranian', dial: '98' },
  { code: 'IQ', name: 'Iraq', demonym: 'Iraqi', dial: '964' },
  { code: 'IE', name: 'Ireland', demonym: 'Irish', dial: '353' },
  { code: 'IL', name: 'Israel', demonym: 'Israeli', dial: '972' },
  { code: 'IT', name: 'Italy', demonym: 'Italian', dial: '39' },
  { code: 'JM', name: 'Jamaica', demonym: 'Jamaican', dial: '1876' },
  { code: 'JP', name: 'Japan', demonym: 'Japanese', dial: '81' },
  { code: 'JO', name: 'Jordan', demonym: 'Jordanian', dial: '962' },
  { code: 'KZ', name: 'Kazakhstan', demonym: 'Kazakh', dial: '7' },
  { code: 'KE', name: 'Kenya', demonym: 'Kenyan', dial: '254' },
  { code: 'KI', name: 'Kiribati', demonym: 'I-Kiribati', dial: '686' },
  { code: 'KW', name: 'Kuwait', demonym: 'Kuwaiti', dial: '965' },
  { code: 'KG', name: 'Kyrgyzstan', demonym: 'Kyrgyz', dial: '996' },
  { code: 'LA', name: 'Laos', demonym: 'Laotian', dial: '856' },
  { code: 'LV', name: 'Latvia', demonym: 'Latvian', dial: '371' },
  { code: 'LB', name: 'Lebanon', demonym: 'Lebanese', dial: '961' },
  { code: 'LS', name: 'Lesotho', demonym: 'Mosotho', dial: '266' },
  { code: 'LR', name: 'Liberia', demonym: 'Liberian', dial: '231' },
  { code: 'LY', name: 'Libya', demonym: 'Libyan', dial: '218' },
  { code: 'LI', name: 'Liechtenstein', demonym: 'Liechtensteiner', dial: '423' },
  { code: 'LT', name: 'Lithuania', demonym: 'Lithuanian', dial: '370' },
  { code: 'LU', name: 'Luxembourg', demonym: 'Luxembourger', dial: '352' },
  { code: 'MO', name: 'Macau', demonym: 'Macanese', dial: '853' },
  { code: 'MG', name: 'Madagascar', demonym: 'Malagasy', dial: '261' },
  { code: 'MW', name: 'Malawi', demonym: 'Malawian', dial: '265' },
  { code: 'MY', name: 'Malaysia', demonym: 'Malaysian', dial: '60' },
  { code: 'MV', name: 'Maldives', demonym: 'Maldivian', dial: '960' },
  { code: 'ML', name: 'Mali', demonym: 'Malian', dial: '223' },
  { code: 'MT', name: 'Malta', demonym: 'Maltese', dial: '356' },
  { code: 'MH', name: 'Marshall Islands', demonym: 'Marshallese', dial: '692' },
  { code: 'MR', name: 'Mauritania', demonym: 'Mauritanian', dial: '222' },
  { code: 'MU', name: 'Mauritius', demonym: 'Mauritian', dial: '230' },
  { code: 'MX', name: 'Mexico', demonym: 'Mexican', dial: '52' },
  { code: 'FM', name: 'Micronesia', demonym: 'Micronesian', dial: '691' },
  { code: 'MD', name: 'Moldova', demonym: 'Moldovan', dial: '373' },
  { code: 'MC', name: 'Monaco', demonym: 'Monegasque', dial: '377' },
  { code: 'MN', name: 'Mongolia', demonym: 'Mongolian', dial: '976' },
  { code: 'ME', name: 'Montenegro', demonym: 'Montenegrin', dial: '382' },
  { code: 'MA', name: 'Morocco', demonym: 'Moroccan', dial: '212' },
  { code: 'MZ', name: 'Mozambique', demonym: 'Mozambican', dial: '258' },
  { code: 'MM', name: 'Myanmar', demonym: 'Myanmar', dial: '95' },
  { code: 'NA', name: 'Namibia', demonym: 'Namibian', dial: '264' },
  { code: 'NR', name: 'Nauru', demonym: 'Nauruan', dial: '674' },
  { code: 'NP', name: 'Nepal', demonym: 'Nepali', dial: '977' },
  { code: 'NL', name: 'Netherlands', demonym: 'Dutch', dial: '31' },
  { code: 'NZ', name: 'New Zealand', demonym: 'New Zealander', dial: '64' },
  { code: 'NI', name: 'Nicaragua', demonym: 'Nicaraguan', dial: '505' },
  { code: 'NE', name: 'Niger', demonym: 'Nigerien', dial: '227' },
  { code: 'NG', name: 'Nigeria', demonym: 'Nigerian', dial: '234' },
  { code: 'KP', name: 'North Korea', demonym: 'North Korean', dial: '850' },
  { code: 'MK', name: 'North Macedonia', demonym: 'Macedonian', dial: '389' },
  { code: 'NO', name: 'Norway', demonym: 'Norwegian', dial: '47' },
  { code: 'OM', name: 'Oman', demonym: 'Omani', dial: '968' },
  { code: 'PK', name: 'Pakistan', demonym: 'Pakistani', dial: '92' },
  { code: 'PW', name: 'Palau', demonym: 'Palauan', dial: '680' },
  { code: 'PS', name: 'Palestine', demonym: 'Palestinian', dial: '970' },
  { code: 'PA', name: 'Panama', demonym: 'Panamanian', dial: '507' },
  { code: 'PG', name: 'Papua New Guinea', demonym: 'Papua New Guinean', dial: '675' },
  { code: 'PY', name: 'Paraguay', demonym: 'Paraguayan', dial: '595' },
  { code: 'PE', name: 'Peru', demonym: 'Peruvian', dial: '51' },
  { code: 'PH', name: 'Philippines', demonym: 'Filipino', dial: '63' },
  { code: 'PL', name: 'Poland', demonym: 'Polish', dial: '48' },
  { code: 'PT', name: 'Portugal', demonym: 'Portuguese', dial: '351' },
  { code: 'QA', name: 'Qatar', demonym: 'Qatari', dial: '974' },
  { code: 'RO', name: 'Romania', demonym: 'Romanian', dial: '40' },
  { code: 'RU', name: 'Russia', demonym: 'Russian', dial: '7' },
  { code: 'RW', name: 'Rwanda', demonym: 'Rwandan', dial: '250' },
  { code: 'KN', name: 'Saint Kitts and Nevis', demonym: 'Kittitian', dial: '1869' },
  { code: 'LC', name: 'Saint Lucia', demonym: 'Saint Lucian', dial: '1758' },
  { code: 'VC', name: 'Saint Vincent and the Grenadines', demonym: 'Vincentian', dial: '1784' },
  { code: 'WS', name: 'Samoa', demonym: 'Samoan', dial: '685' },
  { code: 'SM', name: 'San Marino', demonym: 'Sammarinese', dial: '378' },
  { code: 'ST', name: 'Sao Tome and Principe', demonym: 'Sao Tomean', dial: '239' },
  { code: 'SA', name: 'Saudi Arabia', demonym: 'Saudi', dial: '966' },
  { code: 'SN', name: 'Senegal', demonym: 'Senegalese', dial: '221' },
  { code: 'RS', name: 'Serbia', demonym: 'Serbian', dial: '381' },
  { code: 'SC', name: 'Seychelles', demonym: 'Seychellois', dial: '248' },
  { code: 'SL', name: 'Sierra Leone', demonym: 'Sierra Leonean', dial: '232' },
  { code: 'SG', name: 'Singapore', demonym: 'Singaporean', dial: '65' },
  { code: 'SK', name: 'Slovakia', demonym: 'Slovak', dial: '421' },
  { code: 'SI', name: 'Slovenia', demonym: 'Slovenian', dial: '386' },
  { code: 'SB', name: 'Solomon Islands', demonym: 'Solomon Islander', dial: '677' },
  { code: 'SO', name: 'Somalia', demonym: 'Somali', dial: '252' },
  { code: 'ZA', name: 'South Africa', demonym: 'South African', dial: '27' },
  { code: 'KR', name: 'South Korea', demonym: 'Korean', dial: '82' },
  { code: 'SS', name: 'South Sudan', demonym: 'South Sudanese', dial: '211' },
  { code: 'ES', name: 'Spain', demonym: 'Spanish', dial: '34' },
  { code: 'LK', name: 'Sri Lanka', demonym: 'Sri Lankan', dial: '94' },
  { code: 'SD', name: 'Sudan', demonym: 'Sudanese', dial: '249' },
  { code: 'SR', name: 'Suriname', demonym: 'Surinamese', dial: '597' },
  { code: 'SE', name: 'Sweden', demonym: 'Swedish', dial: '46' },
  { code: 'CH', name: 'Switzerland', demonym: 'Swiss', dial: '41' },
  { code: 'SY', name: 'Syria', demonym: 'Syrian', dial: '963' },
  { code: 'TW', name: 'Taiwan', demonym: 'Taiwanese', dial: '886' },
  { code: 'TJ', name: 'Tajikistan', demonym: 'Tajik', dial: '992' },
  { code: 'TZ', name: 'Tanzania', demonym: 'Tanzanian', dial: '255' },
  { code: 'TH', name: 'Thailand', demonym: 'Thai', dial: '66' },
  { code: 'TL', name: 'Timor-Leste', demonym: 'Timorese', dial: '670' },
  { code: 'TG', name: 'Togo', demonym: 'Togolese', dial: '228' },
  { code: 'TO', name: 'Tonga', demonym: 'Tongan', dial: '676' },
  { code: 'TT', name: 'Trinidad and Tobago', demonym: 'Trinidadian', dial: '1868' },
  { code: 'TN', name: 'Tunisia', demonym: 'Tunisian', dial: '216' },
  { code: 'TR', name: 'Turkey', demonym: 'Turkish', dial: '90' },
  { code: 'TM', name: 'Turkmenistan', demonym: 'Turkmen', dial: '993' },
  { code: 'TV', name: 'Tuvalu', demonym: 'Tuvaluan', dial: '688' },
  { code: 'UG', name: 'Uganda', demonym: 'Ugandan', dial: '256' },
  { code: 'UA', name: 'Ukraine', demonym: 'Ukrainian', dial: '380' },
  { code: 'AE', name: 'UAE', demonym: 'Emirati', dial: '971' },
  { code: 'GB', name: 'United Kingdom', demonym: 'British', dial: '44' },
  { code: 'US', name: 'United States', demonym: 'American', dial: '1' },
  { code: 'UY', name: 'Uruguay', demonym: 'Uruguayan', dial: '598' },
  { code: 'UZ', name: 'Uzbekistan', demonym: 'Uzbek', dial: '998' },
  { code: 'VU', name: 'Vanuatu', demonym: 'Ni-Vanuatu', dial: '678' },
  { code: 'VA', name: 'Vatican City', demonym: 'Vatican', dial: '379' },
  { code: 'VE', name: 'Venezuela', demonym: 'Venezuelan', dial: '58' },
  { code: 'VN', name: 'Vietnam', demonym: 'Vietnamese', dial: '84' },
  { code: 'YE', name: 'Yemen', demonym: 'Yemeni', dial: '967' },
  { code: 'ZM', name: 'Zambia', demonym: 'Zambian', dial: '260' },
  { code: 'ZW', name: 'Zimbabwe', demonym: 'Zimbabwean', dial: '263' },
];

// Countries the academy actually recruits from, pinned to the top of both
// pickers. Matches the order the old hand-maintained lists used, so the
// derived arrays in constants.js come out byte-identical at the head.
export const PRIORITY_COUNTRY_CODES = ['KW', 'AE', 'SA', 'QA', 'OM', 'BH'];
export const PRIORITY_NATIONALITY_CODES = ['KW', 'PH', 'PK', 'IN', 'NP', 'BD'];

// The free-text escape hatch that both legacy lists ended with. Kept as a
// literal because it is a stored value, not a country.
export const OTHER = 'Other';

// Every dial code in use, for recognising a value that is nothing but a
// prefix. Membership, not a digit-count pattern: "+965 5" compacts to "+9655"
// and a length-based test would read that partly-typed number as a bare
// prefix and discard it.
export const DIAL_CODES = new Set(COUNTRY_DATA.map((c) => c.dial));

const byCode = new Map(COUNTRY_DATA.map((c) => [c.code, c]));
const byName = new Map(COUNTRY_DATA.map((c) => [c.name.toLowerCase(), c]));
const byDemonym = new Map(COUNTRY_DATA.map((c) => [c.demonym.toLowerCase(), c]));

export const countryByCode = (code) => byCode.get(String(code || '').toUpperCase()) || null;

// Resolve a stored country_of_residence string back to its record. Case- and
// whitespace-insensitive so a value typed by hand still matches. Returns null
// for "Other" and for anything off-list — callers must handle that.
export const countryByName = (name) => byName.get(String(name || '').trim().toLowerCase()) || null;

export const countryByDemonym = (demonym) =>
  byDemonym.get(String(demonym || '').trim().toLowerCase()) || null;

// Dial code for a country NAME (not code) — the shape StudentNew needs, since
// the form stores the display name. Returns null when there is no sensible
// prefix (unknown country, or "Other").
export const dialForCountryName = (name) => {
  const c = countryByName(name);
  return c ? c.dial : null;
};

// Flag emoji derived from the ISO code — two regional-indicator code points.
// Cheaper than storing 195 emoji, and impossible to get out of sync.
export const flagFor = (code) => {
  const cc = String(code || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return '';
  return String.fromCodePoint(
    ...cc.split('').map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65)
  );
};

// Build a picker list: priority entries first, a "---" separator, then the
// rest alphabetically, then "Other". `field` is 'name' or 'demonym'.
export const buildList = (field, priorityCodes) => {
  const head = priorityCodes
    .map((code) => byCode.get(code))
    .filter(Boolean)
    .map((c) => c[field]);
  const headSet = new Set(head);
  const tail = COUNTRY_DATA.map((c) => c[field])
    .filter((v) => !headSet.has(v))
    .sort((a, b) => a.localeCompare(b));
  return [...head, '---', ...tail, OTHER];
};
