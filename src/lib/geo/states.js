// State / province / emirate lists, keyed by ISO 3166-1 alpha-2 country code.
//
// Coverage is deliberately partial: countries with a well-defined, stable
// first-level subdivision (and that matter for this store's shipping) get a
// dropdown; every other country falls back to a free-text state field. This is
// the trade-off agreed for "every country" — reliable lists where they exist,
// a text input everywhere else. Add a country here and its field becomes a
// dropdown automatically, with no component changes.

export const STATES = {
  // United Arab Emirates — the seven emirates.
  AE: [
    "Abu Dhabi",
    "Ajman",
    "Dubai",
    "Fujairah",
    "Ras Al Khaimah",
    "Sharjah",
    "Umm Al Quwain",
  ],

  // India — 28 states + 8 union territories.
  IN: [
    "Andhra Pradesh",
    "Arunachal Pradesh",
    "Assam",
    "Bihar",
    "Chhattisgarh",
    "Goa",
    "Gujarat",
    "Haryana",
    "Himachal Pradesh",
    "Jharkhand",
    "Karnataka",
    "Kerala",
    "Madhya Pradesh",
    "Maharashtra",
    "Manipur",
    "Meghalaya",
    "Mizoram",
    "Nagaland",
    "Odisha",
    "Punjab",
    "Rajasthan",
    "Sikkim",
    "Tamil Nadu",
    "Telangana",
    "Tripura",
    "Uttar Pradesh",
    "Uttarakhand",
    "West Bengal",
    "Andaman and Nicobar Islands",
    "Chandigarh",
    "Dadra and Nagar Haveli and Daman and Diu",
    "Delhi",
    "Jammu and Kashmir",
    "Ladakh",
    "Lakshadweep",
    "Puducherry",
  ],

  // United States — 50 states + District of Columbia.
  US: [
    "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
    "Connecticut", "Delaware", "District of Columbia", "Florida", "Georgia",
    "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky",
    "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
    "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
    "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota",
    "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island",
    "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont",
    "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming",
  ],

  // Canada — 10 provinces + 3 territories.
  CA: [
    "Alberta", "British Columbia", "Manitoba", "New Brunswick",
    "Newfoundland and Labrador", "Northwest Territories", "Nova Scotia",
    "Nunavut", "Ontario", "Prince Edward Island", "Quebec", "Saskatchewan",
    "Yukon",
  ],

  // Australia — 6 states + 2 territories.
  AU: [
    "Australian Capital Territory", "New South Wales", "Northern Territory",
    "Queensland", "South Australia", "Tasmania", "Victoria",
    "Western Australia",
  ],

  // United Kingdom — the four nations.
  GB: ["England", "Northern Ireland", "Scotland", "Wales"],

  // Saudi Arabia — 13 administrative regions.
  SA: [
    "Riyadh", "Makkah", "Madinah", "Eastern Province", "Asir", "Tabuk",
    "Hail", "Northern Borders", "Jazan", "Najran", "Al Bahah", "Al Jawf",
    "Qassim",
  ],

  // Qatar — municipalities.
  QA: [
    "Ad Dawhah (Doha)", "Al Rayyan", "Al Wakrah", "Al Khor", "Al Shamal",
    "Al Daayen", "Umm Salal", "Al Shahaniya",
  ],

  // Oman — governorates.
  OM: [
    "Muscat", "Dhofar", "Musandam", "Al Buraimi", "Al Dakhiliyah",
    "Al Batinah North", "Al Batinah South", "Al Sharqiyah North",
    "Al Sharqiyah South", "Al Dhahirah", "Al Wusta",
  ],

  // Kuwait — governorates.
  KW: [
    "Al Asimah (Capital)", "Hawalli", "Farwaniya", "Mubarak Al-Kabeer",
    "Ahmadi", "Jahra",
  ],

  // Bahrain — governorates.
  BH: ["Capital", "Muharraq", "Northern", "Southern"],

  // Pakistan — provinces + territories.
  PK: [
    "Punjab", "Sindh", "Khyber Pakhtunkhwa", "Balochistan", "Gilgit-Baltistan",
    "Azad Jammu and Kashmir", "Islamabad Capital Territory",
  ],

  // Bangladesh — divisions.
  BD: [
    "Barisal", "Chittagong", "Dhaka", "Khulna", "Mymensingh", "Rajshahi",
    "Rangpur", "Sylhet",
  ],

  // Nepal — provinces.
  NP: [
    "Koshi", "Madhesh", "Bagmati", "Gandaki", "Lumbini", "Karnali",
    "Sudurpashchim",
  ],

  // Sri Lanka — provinces.
  LK: [
    "Central", "Eastern", "North Central", "Northern", "North Western",
    "Sabaragamuwa", "Southern", "Uva", "Western",
  ],

  // Malaysia — states + federal territories.
  MY: [
    "Johor", "Kedah", "Kelantan", "Malacca", "Negeri Sembilan", "Pahang",
    "Penang", "Perak", "Perlis", "Sabah", "Sarawak", "Selangor", "Terengganu",
    "Kuala Lumpur", "Labuan", "Putrajaya",
  ],

  // Germany — 16 federal states.
  DE: [
    "Baden-Württemberg", "Bavaria", "Berlin", "Brandenburg", "Bremen",
    "Hamburg", "Hesse", "Lower Saxony", "Mecklenburg-Vorpommern",
    "North Rhine-Westphalia", "Rhineland-Palatinate", "Saarland", "Saxony",
    "Saxony-Anhalt", "Schleswig-Holstein", "Thuringia",
  ],

  // South Africa — 9 provinces.
  ZA: [
    "Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo",
    "Mpumalanga", "North West", "Northern Cape", "Western Cape",
  ],
};

/**
 * Returns the state/province list for a country code, or null when we have no
 * dataset for it (the caller should then render a free-text field).
 */
export function getStates(code) {
  return STATES[String(code || "").toUpperCase()] || null;
}

/** True when a country has a state dropdown available. */
export function hasStates(code) {
  return Array.isArray(getStates(code));
}
