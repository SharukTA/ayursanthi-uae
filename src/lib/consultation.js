// The online consultation form: the question list, and the WhatsApp messages an
// answered form turns into. No imports and no browser APIs, so the rules below
// can be exercised outside React.
//
// The list is the clinic's "Client Case History Form". Only what a client can
// answer about themselves is here — the clinician's parts of the paper form
// (examination findings, diagnosis and plan, the genetic-risk remark, the
// screening action, the clinician's signature) are filled in at the clinic.

// A field's value lives in a flat { [field.id]: value } map: a string, or an
// array for "multi". Ids default to the field's position (see withIds below);
// the handful of fields other code has to find by name set their own.
const text = (label, extra) => ({ type: "text", label, ...extra });
const longText = (label, extra) => ({ type: "textarea", label, ...extra });
const date = (label) => ({ type: "date", label });
const pick = (label, options, detail) => ({ type: "choice", label, options, detail });
const tick = (label, options, detail, extra) => ({ type: "multi", label, options, detail, ...extra });
const yesNo = (label, detailLabel = "Details") =>
  pick(label, ["Yes", "No"], { on: "Yes", label: detailLabel });

// One organ system of the review. The paper form asks "No problem / Yes" for the
// system as a whole and wants details only on a Yes, which is what keeps a
// hundred-odd questions from being a wall for a client with nothing to report.
const system = (id, title, fields, extra) => ({
  id,
  title,
  gate: pick(title, ["No problem", "Yes"]),
  fields: fields.map((field) => (typeof field === "string" ? text(field) : field)),
  ...extra,
});

// A block of inherited conditions, each answered Yes / No + which relative.
const FAMILY_MEMBER = "Which family member?";
const familyYesNo = (label) => yesNo(label, FAMILY_MEMBER);

const SECTIONS = [
  {
    id: "1",
    title: "Client Details",
    fields: [
      text("Name", { id: "name", required: true }),
      text("Age / Date of birth", { id: "age", required: true }),
      { ...pick("Sex", ["Female", "Male", "Other"]), id: "sex", required: true },
      text("Phone / Email", { id: "contact", required: true }),
      longText("Address"),
      text("Occupation (indoor / outdoor / night shift / AC / dust / chemical exposure)"),
      text("Marital status"),
      date("Date of visit"),
      text("Referred by"),
    ],
  },
  {
    id: "2",
    title: "Chief Complaint",
    fields: [
      tick(
        "What is your main concern today?",
        [
          "Acne",
          "Pigmentation",
          "Dull skin",
          "Ageing",
          "Hair fall",
          "Dandruff",
          "Scars",
          "Tan",
          "Open pores",
          "Unwanted hair",
          "Weight or body shaping",
          "Other",
        ],
        { on: "Other", label: "Please describe" },
        { id: "concern", required: true }
      ),
      text("Since when do you have this problem? (days / months / years)"),
      pick("How did it start?", ["Sudden", "Gradual"]),
      pick("Is it getting better, worse or constant?", ["Better", "Worse", "Constant"]),
      longText("What is your expected result and time frame?"),
    ],
  },
  {
    id: "3",
    title: "History of Present Complaint",
    fields: [
      text("Site and spread of the problem (face, neck, scalp, body)"),
      yesNo("Itching, burning, pain, discharge, bleeding or scaling?"),
      text("Does it worsen with sun, heat, sweat, stress, food, menstruation, cosmetics or season?"),
      text("Any similar problem in family members?"),
      longText("Treatments tried so far (home remedies, Ayurvedic, allopathic, homeopathic, clinic procedures)"),
      pick("Result of those treatments", ["Helped", "No change", "Worsened", "Allergic reaction"]),
      text("Any medicine, cream or steroid cream currently used for this?"),
    ],
  },
  {
    id: "4",
    title: "Skin Care and Cosmetic History",
    fields: [
      longText("Current daily routine (cleanser, toner, serum, moisturiser, sunscreen, makeup)"),
      longText("Products used in the last 6 months (names)"),
      yesNo("Use of fairness creams, bleaching agents, steroid-containing creams or unlicensed products?"),
      pick("Sunscreen use?", ["Daily", "Sometimes", "Never"]),
      text("Makeup use and how long it is kept on"),
      text("Hair colour, straightening, smoothening or keratin treatments"),
      text("Waxing, threading, shaving or laser hair removal"),
      longText("Previous facials, peels, microneedling, laser, PRP, fillers, Botox, threads, mesotherapy (type, date, any complication)"),
      text("Tattoos, piercings or permanent makeup"),
    ],
  },
  {
    id: "5",
    title: "Skin Type Self-Assessment",
    fields: [
      pick("Skin feels after washing", ["Tight", "Normal", "Oily", "Oily in T-zone only"]),
      pick("Sensitivity to products", ["Never", "Sometimes", "Frequently"]),
      pick("Tendency to tan", ["Burns easily", "Tans easily", "Rarely tans"]),
      yesNo("Tendency to scar, keloid or dark marks after pimples or injuries"),
    ],
  },
  {
    id: "6",
    title: "Allergy History",
    fields: [
      text("Drug allergy (penicillin, sulfa, NSAIDs, others)"),
      text("Food allergy"),
      text("Contact allergy (nickel, latex, fragrance, hair dye, adhesive, cosmetics)"),
      text("Allergy to nuts, honey, saffron, turmeric, coconut, papaya, aloe or essential oils"),
      yesNo("Asthma, hay fever, hives or eczema ever?"),
      text("Reaction to previous patch test or procedure"),
      text("Ever had anaphylaxis or needed emergency treatment for allergy?"),
    ],
  },
  {
    id: "7",
    title: "Past Medical and Surgical History",
    fields: [
      text("Any major illness or hospital admission in the past?"),
      text("Surgeries (type and year)"),
      text("Blood transfusion ever?"),
      text("Accidents, fractures or head injury"),
      yesNo("Any implants (metal plates, pacemaker, breast or dermal implants, IUD, cochlear implant)?"),
      text("Vaccination status (Hepatitis B, tetanus, COVID-19, HPV)"),
      text("Recent illness, fever or infection in the last 4 weeks"),
    ],
  },
  {
    id: "8",
    title: "Systemic Review – Organ System Wise",
    note: "For each system choose No problem or Yes. If Yes, give details, duration and treatment.",
    groups: [
      system("8.1", "Cardiovascular System", [
        "High blood pressure or low blood pressure?",
        "Chest pain, palpitations, breathlessness on climbing stairs?",
        "Heart disease, heart attack, valve disease, rheumatic fever?",
        "Pacemaker or stent?",
        "Swelling of feet?",
        "Varicose veins, blood clots (DVT) or poor circulation?",
        "High cholesterol or triglycerides?",
        "Bleeding or fainting episodes?",
      ]),
      system("8.2", "Respiratory System", [
        "Asthma, wheezing or allergic rhinitis?",
        "Chronic cough, tuberculosis (past or present), bronchitis, COPD?",
        "Sleep apnoea or snoring?",
        "Frequent colds or sinusitis?",
        "Smoking history (cigarettes, beedi, vaping): how many per day and for how many years?",
      ]),
      system("8.3", "Gastrointestinal System", [
        pick("Appetite and digestion", ["Normal", "Poor", "Excessive"]),
        "Acidity, gastritis, ulcer, GERD, indigestion?",
        "Constipation, loose stools, irritable bowel, bloating, gas?",
        "Bowel frequency per day and stool consistency",
        "Piles, fissure or fistula?",
        "Crohn’s disease or ulcerative colitis?",
        "Food intolerance (lactose, gluten)?",
        "Worm infestation or recurrent stomach infections?",
        "Nausea, vomiting or weight changes?",
      ]),
      system("8.4", "Liver, Gall Bladder and Pancreas", [
        "Jaundice, hepatitis A, B or C, fatty liver?",
        "Gallstones or gall bladder surgery?",
        "Pancreatitis?",
        "Alcohol intake (quantity and frequency)",
        "Persistent itching without rash?",
        "Liver function tests ever abnormal?",
      ]),
      system("8.5", "Renal and Urinary System", [
        "Kidney disease, kidney stones, kidney transplant?",
        "Burning urination, frequent urinary infections?",
        "Swelling of face or feet in the morning?",
        "Frequency of urination, night urination, blood in urine?",
        "Water intake per day (litres)",
      ]),
      system("8.6", "Endocrine and Metabolic System", [
        "Diabetes (type, duration, HbA1c or sugar levels, medicines or insulin)?",
        "Thyroid disorder (hypothyroid / hyperthyroid / goitre / on thyroxine)?",
        "PCOS or PCOD?",
        "Cushing’s syndrome, adrenal or pituitary disorder?",
        "Obesity or sudden weight gain or loss?",
        "Excess hair growth on face or body (hirsutism)?",
        "Hair thinning, dry skin, cold intolerance, excess sweating or heat intolerance?",
        "Vitamin D, B12, iron or calcium deficiency?",
        "Stretch marks or darkening in neck and underarm folds (acanthosis nigricans)?",
        "Slow healing of wounds?",
      ]),
      system(
        "8.7",
        "Reproductive and Gynaecological History (Women)",
        [
          "Age at first period (menarche)",
          "Cycle: regular / irregular, length, flow, pain",
          date("Last menstrual period (date)"),
          "Premenstrual breakouts or mood changes?",
          "Missed periods or very scanty or heavy periods?",
          yesNo("Pregnancy: currently pregnant, trying to conceive or breastfeeding?"),
          "Number of pregnancies, deliveries and miscarriages",
          "Melasma during pregnancy or while on pills?",
          "Contraception used (oral pills, injections, implants, IUD)",
          "Hormone therapy or menopause symptoms (hot flushes, dryness, hair loss)?",
          "Endometriosis, fibroids, ovarian cysts or gynaecological surgery?",
          "History of breast disease or breast cancer?",
        ],
        { hiddenForSex: "Male" }
      ),
      system(
        "8.8",
        "Male Health (Men)",
        [
          "Prostate or urinary problems?",
          "Testosterone therapy, steroids or supplements for muscle building?",
          "Beard or scalp hair problems?",
          "Shaving irritation, ingrown hairs (razor bumps)?",
        ],
        { hiddenForSex: "Female" }
      ),
      system("8.9", "Nervous System", [
        "Epilepsy, seizures or fits?",
        "Migraine, recurrent headaches or vertigo?",
        "Stroke, numbness, tingling, neuropathy?",
        "Facial palsy or muscle weakness (important before Botox or fillers)?",
        "Myasthenia gravis or other neuromuscular disease?",
        "Head injury?",
        "Sleep problems (insomnia, early waking)?",
      ]),
      system("8.10", "Mental Health and Stress", [
        "Anxiety, depression or panic attacks?",
        pick("Current stress level", ["Low", "Moderate", "High"]),
        "Habits such as skin picking, hair pulling or nail biting?",
        "Concerns about body image or appearance affecting daily life?",
        "Any psychiatric medicines (antidepressants, antipsychotics, mood stabilisers)?",
      ]),
      system("8.11", "Musculoskeletal System", [
        "Arthritis, joint pain, back pain or neck pain?",
        "Osteoporosis or fractures?",
        "Muscle pain or weakness?",
        "Gout?",
        "Orthopaedic implants or recent injury in the treatment area?",
      ]),
      system("8.12", "Haematological System (Blood)", [
        "Anaemia (low haemoglobin)?",
        "Easy bruising or prolonged bleeding after cuts, extractions or surgery?",
        "Haemophilia, thalassaemia, sickle cell, platelet disorders?",
        "Taking blood thinners (aspirin, warfarin, clopidogrel, heparin)?",
        "Recent blood tests (Hb, platelets, ESR) and results",
      ]),
      system("8.13", "Immune System and Autoimmune Diseases", [
        "Lupus (SLE), rheumatoid arthritis, scleroderma, Sjögren’s?",
        "Psoriasis, vitiligo, alopecia areata, pemphigus, pemphigoid?",
        "Coeliac disease, autoimmune thyroiditis?",
        "HIV or low immunity, long-term steroids, organ transplant?",
        "Frequent infections or poor wound healing?",
        "Chronic fatigue, recurrent mouth ulcers, joint pains with rashes?",
      ]),
      system("8.14", "Infectious Diseases", [
        "Hepatitis B or C, HIV, syphilis, tuberculosis, COVID-19 (past or recent)?",
        "Recurrent cold sores (herpes simplex) – important before laser, peels or fillers",
        "Warts, molluscum, fungal infections (ringworm, tinea, candida)?",
        "Bacterial skin infections (boils, abscess, impetigo, cellulitis)?",
        "Scabies, lice or other infestations?",
        yesNo("Any active infection in the treatment area?"),
      ]),
      system("8.15", "Skin, Hair and Nail Conditions", [
        "Acne (type, grade, scarring), rosacea, perioral dermatitis?",
        "Eczema, atopic dermatitis, seborrhoeic dermatitis, contact dermatitis?",
        "Psoriasis, lichen planus, urticaria (hives)?",
        "Vitiligo, melasma, post-inflammatory pigmentation, freckles?",
        "Keloids or hypertrophic scars?",
        "Hair fall (pattern, duration, shedding amount), dandruff, scalp itching?",
        "Nail changes (brittle, ridging, fungal)?",
        "Moles that changed in size, shape or colour; any non-healing sore?",
        "Skin cancer (basal cell, squamous cell, melanoma) in client or family?",
        "Sun sensitivity or photosensitive rash?",
        "Hyperhidrosis (excess sweating)?",
      ]),
      system("8.16", "Eyes, ENT and Dental", [
        "Glaucoma, cataract, dry eyes, recent eye surgery (LASIK)?",
        "Contact lens use?",
        "Chronic sinusitis, hearing problems, vertigo?",
        "Dental infection, gum disease or recent dental procedure (important before lip fillers)?",
        "Dark circles, puffiness, eyelid swelling?",
      ]),
      system("8.17", "Cancer and Oncology History", [
        "Any cancer in the past or present (type, year, treatment)?",
        "Chemotherapy, radiotherapy or immunotherapy history?",
        "Precancerous lesions (e.g. actinic keratosis)?",
        "Family history of cancer?",
      ]),
    ],
  },
  {
    id: "9",
    title: "Medication History",
    fields: [
      longText("List all current medicines, supplements and herbal products (name, dose, duration)"),
      yesNo("Isotretinoin (Accutane) in the last 6–12 months?"),
      text("Oral or topical retinoids (tretinoin, adapalene) currently?"),
      text("Steroids (oral, injection, cream or inhaler) in the last 3 months?"),
      text("Antibiotics, antifungals, antimalarials, anti-TB drugs?"),
      text("Photosensitising drugs (doxycycline, NSAIDs, diuretics, amiodarone, St John’s wort)?"),
      text("Blood thinners, aspirin, fish oil, vitamin E, ginkgo, garlic supplements?"),
      text("Hormonal pills, thyroid medicines, insulin, diabetes tablets?"),
      text("Immunosuppressants, biologics, methotrexate, chemotherapy?"),
      text("Hair growth medicines (minoxidil, finasteride, dutasteride)?"),
      text("Painkillers or sleep aids used regularly?"),
      text("Last dose or stop date of any of the above"),
    ],
  },
  {
    id: "10",
    title: "Family History",
    note: "Any of the following in parents, siblings or grandparents?",
    fields: [
      tick(
        "Conditions in the family",
        [
          "Diabetes",
          "Hypertension",
          "Heart disease",
          "Thyroid disorder",
          "PCOS",
          "Cancer",
          "Asthma or allergy",
          "Eczema or psoriasis",
          "Vitiligo",
          "Alopecia or early baldness",
          "Keloid tendency",
          "Autoimmune disease",
          "Bleeding disorder",
          "Premature greying",
          "Genetic or hereditary skin disease",
        ],
        { on: "Cancer", label: "Type of cancer" }
      ),
      longText("Details"),
    ],
  },
  {
    id: "11",
    title: "Genetic History",
    note: "Choose Yes or No, and note which family member is affected (father, mother, sibling, grandparent, aunt or uncle, cousin).",
    groups: [
      {
        id: "11.1",
        title: "Ancestry and Family Background",
        fields: [
          text("Ethnic or regional background of mother and father"),
          yesNo("Are your parents blood relatives (consanguineous marriage)?", "Relation"),
          text("Number of siblings, and any with a similar skin, hair or health problem"),
          familyYesNo("Any child, sibling or relative with birth defects, developmental delay or intellectual disability?"),
          familyYesNo("Any miscarriages, stillbirths or infant deaths in the family?"),
          familyYesNo("Any family member with infertility or difficulty conceiving?"),
        ],
      },
      {
        id: "11.2",
        title: "Inherited Skin, Hair and Nail Conditions",
        fields: [
          familyYesNo("Eczema, atopic dermatitis, asthma or hay fever (atopy) in the family?"),
          familyYesNo("Psoriasis, vitiligo, alopecia areata or other autoimmune skin disease?"),
          familyYesNo("Ichthyosis (very dry, scaly skin), keratosis pilaris or palmoplantar keratoderma?"),
          familyYesNo("Albinism or unusually light skin, hair or eyes?"),
          familyYesNo("Early melasma, freckling or familial hyperpigmentation?"),
          familyYesNo("Keloid or hypertrophic scar tendency in the family?"),
          familyYesNo("Severe or scarring acne in parents or siblings?"),
          familyYesNo("Early male or female pattern baldness, or early greying (before age 25)?"),
          familyYesNo("Hirsutism (excess hair) or very sparse body hair?"),
          familyYesNo("Hereditary hair shaft, nail or tooth abnormalities?"),
          familyYesNo("Neurofibromatosis (multiple café-au-lait spots or skin nodules) or tuberous sclerosis?"),
          familyYesNo("Epidermolysis bullosa or easy blistering of skin?"),
          familyYesNo("Excess moles, atypical moles or birthmarks (congenital naevus, port-wine stain)?"),
          familyYesNo("Early skin ageing, loose or very stretchy skin, easy bruising, or hypermobile joints (Ehlers-Danlos or Marfan features)?"),
        ],
      },
      {
        id: "11.3",
        title: "Inherited Systemic and Metabolic Disorders",
        fields: [
          familyYesNo("Diabetes (type 1 or 2) or gestational diabetes?"),
          familyYesNo("Thyroid disorder or PCOS?"),
          familyYesNo("High cholesterol (familial hypercholesterolaemia), early heart attack or stroke (before age 55 in men, 65 in women)?"),
          familyYesNo("Hypertension or sudden cardiac death at a young age?"),
          familyYesNo("Kidney disease, polycystic kidney disease or kidney stones?"),
          familyYesNo("Liver disease, Wilson’s disease or haemochromatosis?"),
          familyYesNo("Thalassaemia, sickle cell disease, G6PD deficiency or other anaemias?"),
          familyYesNo("Haemophilia, von Willebrand disease or easy bleeding?"),
          familyYesNo("Cystic fibrosis or chronic lung disease?"),
          familyYesNo("Epilepsy or neurological or muscle disorders (muscular dystrophy)?"),
          familyYesNo("Psychiatric illness such as depression, bipolar disorder or schizophrenia?"),
          familyYesNo("Osteoporosis, early arthritis or gout?"),
          familyYesNo("Autoimmune diseases (lupus, rheumatoid arthritis, coeliac disease, multiple sclerosis)?"),
          familyYesNo("Obesity or metabolic syndrome running in the family?"),
          familyYesNo("Eye conditions such as glaucoma, early cataract or hereditary vision loss?"),
          familyYesNo("Hearing loss from childhood?"),
        ],
      },
      {
        id: "11.4",
        title: "Hereditary Cancer History",
        fields: [
          longText("Any cancer in first- or second-degree relatives (type and age at diagnosis)"),
          familyYesNo("Breast, ovarian, colon, prostate, pancreatic or thyroid cancer in the family?"),
          familyYesNo("Skin cancer or melanoma in the family?"),
          familyYesNo("More than one cancer in the same person, or cancer before age 50?"),
          familyYesNo("Known BRCA1, BRCA2, Lynch syndrome or other cancer gene mutation in the family?"),
        ],
      },
      {
        id: "11.5",
        title: "Genetic Testing and Medicine Response",
        fields: [
          yesNo("Have you or a relative had genetic testing, karyotyping or carrier screening?", "Result"),
          familyYesNo("Any diagnosed chromosomal or genetic syndrome (Down, Turner, Klinefelter, etc.) in you or a relative?"),
          familyYesNo("Any family history of severe reactions to anaesthesia (malignant hyperthermia) or to medicines?"),
          familyYesNo("Family tendency to poor wound healing, abnormal scarring or excessive bleeding after procedures?"),
          familyYesNo("Sun sensitivity or sunburn pattern running in the family?"),
        ],
      },
      {
        id: "11.6",
        title: "Genetic Pedigree Notes",
        fields: [
          longText("Describe the family tree (three generations if possible) showing affected members, age of onset and cause of death"),
        ],
      },
    ],
  },
  {
    id: "12",
    title: "Personal and Lifestyle History",
    fields: [
      pick("Diet", ["Vegetarian", "Non-vegetarian", "Vegan", "Eggetarian"]),
      text("Meals per day, junk food, sugar, dairy, spicy or fried food intake"),
      text("Water intake per day (glasses or litres)"),
      text("Tea, coffee, soft drinks per day"),
      pick("Alcohol", ["Never", "Occasional", "Regular"], { on: "Regular", label: "Quantity" }),
      pick("Smoking or tobacco chewing", ["Never", "Past", "Current"]),
      text("Recreational drug use"),
      text("Sleep: hours per night, quality, bedtime"),
      text("Exercise: type and frequency"),
      text("Sun exposure per day (hours) and use of protection (hat, umbrella, sunscreen)"),
      text("Screen time per day"),
      text("Stress level, work pressure, emotional wellbeing"),
      text("Exposure to pollution, dust, chemicals, hard water, hot kitchen or smoke"),
      text("Recent travel or change of climate or water"),
      text("Weight change in last 6 months (gain or loss, intentional or not)"),
      text("Height / Weight / BMI"),
    ],
  },
  {
    id: "13",
    title: "Ayurvedic Assessment (Optional)",
    fields: [
      pick("Prakriti (body constitution)", ["Vata", "Pitta", "Kapha", "Mixed"]),
      pick("Agni (digestion strength)", ["Strong", "Variable", "Weak", "Irregular"]),
      pick("Koshta (bowel nature)", ["Mridu (soft)", "Madhya (medium)", "Krura (hard)"]),
      text("Appetite and thirst pattern"),
      pick("Sweating", ["Less", "Normal", "Excess, with or without odour"]),
      pick("Body temperature tendency", ["Feels hot", "Feels cold", "Balanced"]),
      pick("Sleep pattern", ["Light and disturbed", "Moderate", "Deep and long"]),
      pick("Mental nature", ["Anxious", "Irritable", "Calm"]),
      text("Skin and hair nature as per dosha"),
      text("Seasonal aggravation of the complaint"),
      longText("Previous Ayurvedic treatments (Panchakarma, Abhyanga, Shirodhara, Lepa, internal medicines)"),
      text("Religious, dietary or fasting restrictions to be respected"),
    ],
  },
  {
    id: "14",
    title: "Procedure-Specific Contraindication Screening",
    note: "Tick any that apply, as these may restrict or delay treatment.",
    fields: [
      tick("Applies to me", [
        "Pregnancy or breastfeeding",
        "Active infection, cold sore, open wound or severe acne in treatment area",
        "Isotretinoin within the last 6–12 months",
        "Recent sunburn, tanning or sun exposure",
        "Keloid or hypertrophic scar tendency",
        "Uncontrolled diabetes, hypertension or thyroid disease",
        "Bleeding disorder or on blood thinners",
        "Autoimmune disease or immunosuppression",
        "Pacemaker or metal implants (for energy-based devices)",
        "History of epilepsy (for light-based devices)",
        "Active vitiligo, psoriasis or eczema in treatment area",
        "Allergy to local anaesthetic, latex or a product ingredient",
        "History of skin cancer or suspicious mole",
        "Recent chemical peel, laser, waxing or dermabrasion within 2 weeks",
      ]),
    ],
  },
  {
    id: "15",
    title: "Client Declaration and Consent",
    fields: [
      tick(
        "Declaration",
        [
          "I confirm that the information given above is true and complete to the best of my knowledge. I have been informed about the procedure, expected results, possible side effects and aftercare. I consent to treatment and to confidential record keeping. I understand that results vary from person to person.",
        ],
        undefined,
        { id: "consent", required: true }
      ),
      text("Client signature (type your full name)", { id: "signature", required: true }),
      { ...date("Date"), id: "signatureDate", required: true, notPast: true },
    ],
  },
];

// Give every field without an explicit id a stable one from its position, and
// every gate an id of its own under the group it controls.
function withIds(fields, prefix) {
  return fields.map((field, i) => ({ ...field, id: field.id ?? `${prefix}.${i + 1}` }));
}

export const CONSULTATION_SECTIONS = SECTIONS.map((section) => ({
  ...section,
  fields: section.fields ? withIds(section.fields, section.id) : undefined,
  groups: section.groups?.map((group) => ({
    ...group,
    gate: group.gate ? { ...group.gate, id: `${group.id}.status` } : undefined,
    fields: withIds(group.fields, group.id),
  })),
}));

// The extra box a choice can reveal ("Yes" → "Which family member?") is stored
// beside the choice itself.
export const detailId = (field) => `${field.id}.detail`;

export function detailVisible(field, values) {
  if (!field.detail) return false;
  const value = values[field.id];
  return Array.isArray(value) ? value.includes(field.detail.on) : value === field.detail.on;
}

// Women's questions are hidden once the client says Male and vice versa. "Other"
// and not-yet-answered see both, so nobody is ever denied a section.
export function groupVisible(group, values) {
  return !group.hiddenForSex || values.sex !== group.hiddenForSex;
}

// Whether a group's own questions are on screen, which is also what decides if
// they are sent: an answer typed under Yes must not travel once the client has
// switched that system back to "No problem".
export function groupFieldsVisible(group, values) {
  return !group.gate || values[group.gate.id] === "Yes";
}

const clean = (value) => String(value ?? "").trim();

// A date input hands back YYYY-MM-DD. The clinic reads DD/MM/YYYY, the same as the
// date at the top of the message.
const displayDate = (value) => value.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$3/$2/$1");

function fieldAnswer(field, values) {
  const raw = values[field.id];
  const answer = Array.isArray(raw)
    ? raw.join(", ")
    : field.type === "date"
      ? displayDate(clean(raw))
      : clean(raw);
  if (!answer) return "";
  const detail = detailVisible(field, values) ? clean(values[detailId(field)]) : "";
  return detail ? `${answer} (${field.detail.label}: ${detail})` : answer;
}

function answerLine(field, values) {
  const answer = fieldAnswer(field, values);
  if (!answer) return null;
  return field.label.endsWith("?") ? `• ${field.label} ${answer}` : `• ${field.label}: ${answer}`;
}

function answerLines(fields, values) {
  return fields.map((field) => answerLine(field, values)).filter(Boolean);
}

function groupLines(group, values) {
  if (!groupVisible(group, values)) return [];

  const answers = groupFieldsVisible(group, values) ? answerLines(group.fields, values) : [];
  const status = group.gate ? clean(values[group.gate.id]) : "";
  if (!answers.length && !status) return [];

  const heading = `${group.id} ${group.title}`;
  return [status ? `_${heading}:_ ${status}` : `_${heading}_`, ...answers];
}

/** What a section contributes to the message. Empty means nothing answered. */
export function sectionLines(section, values) {
  if (section.groups) return section.groups.flatMap((group) => groupLines(group, values));
  return answerLines(section.fields, values);
}

/**
 * Today on the client's own calendar, as the YYYY-MM-DD a date input uses. Not
 * toISOString(): that is the UTC date, which is still yesterday for the first
 * hours of the morning in the UAE and India.
 */
export function localDateString(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** What an empty form starts with: the declaration is dated today. */
export const startingValues = (today) => ({ signatureDate: today });

/**
 * Every field that blocks submitting, in form order, with the section it is in.
 * Past dates are checked here as well as limited on the input, because `min` only
 * restricts the picker and a date can still be typed in by hand.
 */
export function formProblems(values, today) {
  return CONSULTATION_SECTIONS.flatMap((section) =>
    (section.fields ?? []).flatMap((field) => {
      const problem = { sectionId: section.id, fieldId: field.id, label: field.label };
      if (field.required && !fieldAnswer(field, values)) return [{ ...problem, message: "Required" }];
      if (field.notPast && values[field.id] && values[field.id] < today) {
        return [{ ...problem, message: "Cannot be before today" }];
      }
      return [];
    })
  );
}

// The longest URL-encoded message put in one WhatsApp link. wa.me itself accepted
// links of 32,000 characters when probed, but what a phone's app or a browser's
// hand-off to it will take is not published and differs by device, so this stays
// well short of that. Encoded length is what counts, which is why an Arabic or
// Malayalam answer uses up the allowance several times faster than English.
const MAX_ENCODED_MESSAGE = 4000;
// Held back from each chunk for the "Part 2 of 3" line added once the count is
// known. Sized for its 40-character name at the worst-case encoded width.
const PART_HEADER_RESERVE = 600;

const encodedLength = (value) => encodeURIComponent(value).length;

/** Splits on line breaks, falling back to characters for one oversized line. */
export function splitMessage(message, limit) {
  const chunks = [];
  let current = "";
  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };

  for (const line of message.split("\n")) {
    const candidate = current ? `${current}\n${line}` : line;
    if (encodedLength(candidate) <= limit) {
      current = candidate;
      continue;
    }
    flush();
    // Iterating by code point, so an emoji is never cut in half — half of one
    // makes encodeURIComponent throw.
    for (const char of line) {
      if (encodedLength(current + char) > limit) flush();
      current += char;
    }
  }
  flush();
  return chunks;
}

/**
 * The answered form as one or more WhatsApp messages, unanswered questions left
 * out. `today` is passed in so the date on the record is the one the client saw.
 */
export function buildConsultationMessages(values, today) {
  const blocks = [
    `*Ayurshanti Beauty Clinic – Client Case History Form*\nOnline consultation request\nDate: ${today}`,
  ];
  for (const section of CONSULTATION_SECTIONS) {
    const lines = sectionLines(section, values);
    if (lines.length) blocks.push([`*${section.id}. ${section.title}*`, ...lines].join("\n"));
  }

  // toWellFormed: a stray half-emoji pasted into an answer would otherwise make
  // encodeURIComponent throw and the submit button appear to do nothing.
  const message = blocks.join("\n\n").toWellFormed();
  const chunks = splitMessage(message, MAX_ENCODED_MESSAGE - PART_HEADER_RESERVE);
  if (chunks.length === 1) return chunks;

  // Two messages from the same client can arrive among other chats, so each one
  // says whose it is and where it belongs.
  const name = Array.from(clean(values.name)).slice(0, 40).join("");
  return chunks.map((chunk, i) => `*Part ${i + 1} of ${chunks.length} – ${name}*\n\n${chunk}`);
}

/** wa.me takes digits only — no plus, no spaces, no dashes. */
export function whatsappUrl(number, message) {
  const base = `https://wa.me/${String(number ?? "").replace(/\D/g, "")}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
