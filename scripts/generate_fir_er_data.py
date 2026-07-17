"""
Generate masked dummy CSV seed data for the Police FIR ER schema.

The output follows the table structure described in Police_FIR_ER_Diagram.pdf.
Person names are deliberately masked:
  - employees: OFF-A, OFF-B, ...
  - complainants: CMP-A, CMP-B, ...
  - victims: VIC-A, VIC-B, ...
  - accused: ACC-A, ACC-B, ...
"""

import csv
import random
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent / "data"
random.seed(20260714)

YEARS = range(2020, 2026)
CASE_CATEGORY_CODE = {
    1: "1",  # FIR
    3: "3",  # UDR
    4: "4",  # PAR
    8: "8",  # Zero FIR
}

DISTRICT_SEEDS = [
    ("Bengaluru Urban", 12.9716, 77.5946, 12700000),
    ("Bengaluru Rural", 13.1986, 77.5677, 990000),
    ("Mysuru", 12.2958, 76.6394, 3000000),
    ("Tumakuru", 13.3379, 77.1173, 2700000),
    ("Dakshina Kannada", 12.8438, 74.9900, 2100000),
    ("Belagavi", 15.8497, 74.4977, 4900000),
    ("Kalaburagi", 17.3297, 76.8343, 2600000),
    ("Dharwad", 15.4589, 75.0078, 1800000),
    ("Ballari", 15.1394, 76.9214, 2500000),
    ("Hassan", 13.0068, 76.1003, 1700000),
    ("Shivamogga", 13.9299, 75.5681, 1750000),
    ("Udupi", 13.3409, 74.7421, 1175000),
]

STATION_NAMES = {
    "Bengaluru Urban": ["Cubbon Park PS", "Shivajinagar PS", "Whitefield PS", "HSR Layout PS", "Koramangala PS", "Yelahanka PS"],
    "Bengaluru Rural": ["Devanahalli PS", "Doddaballapur PS", "Nelamangala PS"],
    "Mysuru": ["Nazarbad PS", "Kuvempunagar PS", "Hebbal PS", "V.V. Mohalla PS"],
    "Tumakuru": ["Tumakuru City PS", "Tiptur PS", "Sira PS"],
    "Dakshina Kannada": ["Mangaluru City PS", "Bunder PS", "Ullal PS"],
    "Belagavi": ["Belagavi City PS", "Tilakwadi PS", "Khasbag PS", "Gokak PS"],
    "Kalaburagi": ["Kalaburagi City PS", "Aland PS", "Yadgir PS"],
    "Dharwad": ["Dharwad PS", "Hubballi PS", "Navanagar PS"],
    "Ballari": ["Ballari City PS", "Sandur PS", "Hosapete PS"],
    "Hassan": ["Hassan PS", "Belur PS", "Sakleshpur PS"],
    "Shivamogga": ["Shivamogga PS", "Sagar PS", "Bhadravathi PS"],
    "Udupi": ["Udupi PS", "Manipal PS", "Kundapura PS"],
}

CRIME_HEADS = [
    (1, "Crimes Against Body", ["Murder", "Assault", "Kidnapping", "Sexual Assault"]),
    (2, "Crimes Against Property", ["Theft", "Robbery", "Burglary", "Vandalism"]),
    (3, "Economic Offences", ["Fraud", "Cyber Fraud", "Cheque Fraud"]),
    (4, "Narcotics Offences", ["Drug Possession", "Drug Trafficking"]),
    (5, "Public Order Offences", ["Unlawful Assembly", "Rioting"]),
]

ACTS = [
    ("IPC", "Indian Penal Code", "IPC"),
    ("BNS", "Bharatiya Nyaya Sanhita", "BNS"),
    ("IT", "Information Technology Act", "IT Act"),
    ("NDPS", "Narcotic Drugs and Psychotropic Substances Act", "NDPS"),
    ("POCSO", "Protection of Children from Sexual Offences Act", "POCSO"),
]

SECTION_MAP = {
    "Murder": ("IPC", "302", "Punishment for murder"),
    "Assault": ("IPC", "323", "Voluntarily causing hurt"),
    "Kidnapping": ("IPC", "363", "Kidnapping"),
    "Sexual Assault": ("POCSO", "8", "Punishment for sexual assault"),
    "Theft": ("IPC", "379", "Theft"),
    "Robbery": ("IPC", "392", "Robbery"),
    "Burglary": ("IPC", "457", "Lurking house trespass or house-breaking by night"),
    "Vandalism": ("IPC", "427", "Mischief causing damage"),
    "Fraud": ("IPC", "420", "Cheating and dishonestly inducing delivery of property"),
    "Cyber Fraud": ("IT", "66D", "Cheating by personation using computer resource"),
    "Cheque Fraud": ("IPC", "420", "Cheating and dishonestly inducing delivery of property"),
    "Drug Possession": ("NDPS", "20", "Cannabis possession"),
    "Drug Trafficking": ("NDPS", "21", "Manufactured drugs and preparations"),
    "Unlawful Assembly": ("IPC", "143", "Member of unlawful assembly"),
    "Rioting": ("IPC", "147", "Rioting"),
}


def alpha_code(index):
    letters = []
    while index:
        index, rem = divmod(index - 1, 26)
        letters.append(chr(65 + rem))
    return "".join(reversed(letters))


def write_csv(name, rows, fieldnames=None):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    path = DATA_DIR / name
    if fieldnames is None:
        fieldnames = list(rows[0].keys()) if rows else []
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)
    print(f"{name}: {len(rows)} rows")


def rand_dt(year):
    start = datetime(year, 1, 1, 0, 0)
    end = datetime(year, 12, 31, 23, 59)
    delta = end - start
    return start + timedelta(minutes=random.randint(0, int(delta.total_seconds() // 60)))


def date_str(value):
    return value.strftime("%Y-%m-%d")


def datetime_str(value):
    return value.strftime("%Y-%m-%d %H:%M:%S")


def jitter(lat, lng, radius=0.08):
    return round(lat + random.uniform(-radius, radius), 6), round(lng + random.uniform(-radius, radius), 6)


def build_static_tables():
    states = [
        {"StateID": 1, "StateName": "Karnataka", "NationalityID": 1, "Active": 1},
        {"StateID": 2, "StateName": "Maharashtra", "NationalityID": 1, "Active": 1},
        {"StateID": 3, "StateName": "Tamil Nadu", "NationalityID": 1, "Active": 1},
        {"StateID": 4, "StateName": "Kerala", "NationalityID": 1, "Active": 1},
    ]

    districts = [
        {
            "DistrictID": idx,
            "DistrictName": name,
            "StateID": 1,
            "Active": 1,
            "Latitude": lat,
            "Longitude": lng,
            "Population": population,
        }
        for idx, (name, lat, lng, population) in enumerate(DISTRICT_SEEDS, 1)
    ]

    unit_types = [
        {"UnitTypeID": 1, "UnitTypeName": "State HQ", "CityDistState": "State", "Hierarchy": 1, "Active": 1},
        {"UnitTypeID": 2, "UnitTypeName": "District Police Office", "CityDistState": "District", "Hierarchy": 2, "Active": 1},
        {"UnitTypeID": 3, "UnitTypeName": "Circle Office", "CityDistState": "District", "Hierarchy": 3, "Active": 1},
        {"UnitTypeID": 4, "UnitTypeName": "Police Station", "CityDistState": "City", "Hierarchy": 4, "Active": 1},
    ]

    units = [{"UnitID": 1, "UnitName": "Karnataka State Police HQ", "TypeID": 1, "ParentUnit": "", "NationalityID": 1, "StateID": 1, "DistrictID": "", "Active": 1}]
    unit_id = 2
    district_unit_ids = {}
    station_units = []
    for district in districts:
        district_unit_ids[district["DistrictID"]] = unit_id
        units.append({
            "UnitID": unit_id,
            "UnitName": f"{district['DistrictName']} DPO",
            "TypeID": 2,
            "ParentUnit": 1,
            "NationalityID": 1,
            "StateID": 1,
            "DistrictID": district["DistrictID"],
            "Active": 1,
        })
        unit_id += 1
        for station_name in STATION_NAMES[district["DistrictName"]]:
            lat, lng = jitter(district["Latitude"], district["Longitude"])
            row = {
                "UnitID": unit_id,
                "UnitName": station_name,
                "TypeID": 4,
                "ParentUnit": district_unit_ids[district["DistrictID"]],
                "NationalityID": 1,
                "StateID": 1,
                "DistrictID": district["DistrictID"],
                "Active": 1,
                "Latitude": lat,
                "Longitude": lng,
            }
            units.append({k: row[k] for k in ["UnitID", "UnitName", "TypeID", "ParentUnit", "NationalityID", "StateID", "DistrictID", "Active"]})
            station_units.append(row)
            unit_id += 1

    ranks = [
        {"RankID": 1, "RankName": "Deputy Superintendent of Police", "Hierarchy": 1, "Active": 1},
        {"RankID": 2, "RankName": "Inspector", "Hierarchy": 2, "Active": 1},
        {"RankID": 3, "RankName": "Sub-Inspector", "Hierarchy": 3, "Active": 1},
        {"RankID": 4, "RankName": "Assistant Sub-Inspector", "Hierarchy": 4, "Active": 1},
        {"RankID": 5, "RankName": "Head Constable", "Hierarchy": 5, "Active": 1},
        {"RankID": 6, "RankName": "Constable", "Hierarchy": 6, "Active": 1},
    ]

    designations = [
        {"DesignationID": 1, "DesignationName": "Station House Officer", "Active": 1, "SortOrder": 1},
        {"DesignationID": 2, "DesignationName": "Investigating Officer", "Active": 1, "SortOrder": 2},
        {"DesignationID": 3, "DesignationName": "Crime Writer", "Active": 1, "SortOrder": 3},
        {"DesignationID": 4, "DesignationName": "Beat Officer", "Active": 1, "SortOrder": 4},
    ]

    employees = []
    employee_id = 1
    for station in station_units:
        for offset in range(3):
            code = alpha_code(employee_id)
            rank_id = [2, 3, 4][offset]
            designation_id = [1, 2, 3][offset]
            dob_year = 1974 + ((employee_id * 5) % 24)
            employees.append({
                "EmployeeID": employee_id,
                "DistrictID": station["DistrictID"],
                "UnitID": station["UnitID"],
                "RankID": rank_id,
                "DesignationID": designation_id,
                "KGID": f"KGID-{employee_id:05d}",
                "FirstName": f"OFF-{code}",
                "EmployeeDOB": f"{dob_year}-{(employee_id % 12) + 1:02d}-{(employee_id % 27) + 1:02d}",
                "GenderID": 1 + (employee_id % 3 == 0),
                "BloodGroupID": 1 + (employee_id % 8),
                "PhysicallyChallenged": 0,
                "AppointmentDate": f"{2002 + (employee_id % 18)}-{((employee_id + 3) % 12) + 1:02d}-15",
            })
            employee_id += 1

    courts = []
    for district in districts:
        courts.append({
            "CourtID": district["DistrictID"],
            "CourtName": f"{district['DistrictName']} District Court",
            "DistrictID": district["DistrictID"],
            "StateID": 1,
            "Active": 1,
        })

    crime_heads = []
    crime_sub_heads = []
    sub_head_id = 1
    for head_id, head_name, sub_heads in CRIME_HEADS:
        crime_heads.append({"CrimeHeadID": head_id, "CrimeGroupName": head_name, "Active": 1})
        for seq, sub_name in enumerate(sub_heads, 1):
            crime_sub_heads.append({
                "CrimeSubHeadID": sub_head_id,
                "CrimeHeadID": head_id,
                "CrimeHeadName": sub_name,
                "SeqID": seq,
            })
            sub_head_id += 1

    acts = [
        {"ActCode": code, "ActDescription": description, "ShortName": short_name, "Active": 1}
        for code, description, short_name in ACTS
    ]

    sections_seen = set()
    sections = []
    for act_code, section_code, section_desc in SECTION_MAP.values():
        key = (act_code, section_code)
        if key in sections_seen:
            continue
        sections_seen.add(key)
        sections.append({
            "ActCode": act_code,
            "SectionCode": section_code,
            "SectionDescription": section_desc,
            "Active": 1,
        })

    sub_head_by_name = {row["CrimeHeadName"]: row for row in crime_sub_heads}
    crime_head_act_sections = []
    for sub_name, (act_code, section_code, _) in SECTION_MAP.items():
        crime_head_act_sections.append({
            "CrimeHeadID": sub_head_by_name[sub_name]["CrimeHeadID"],
            "ActCode": act_code,
            "SectionCode": section_code,
        })

    return {
        "state": states,
        "district": districts,
        "unit_type": unit_types,
        "unit": units,
        "station_units": station_units,
        "rank": ranks,
        "designation": designations,
        "employee": employees,
        "court": courts,
        "crime_head": crime_heads,
        "crime_sub_head": crime_sub_heads,
        "act": acts,
        "section": sections,
        "crime_head_act_section": crime_head_act_sections,
        "case_category": [
            {"CaseCategoryID": 1, "LookupValue": "FIR"},
            {"CaseCategoryID": 3, "LookupValue": "UDR"},
            {"CaseCategoryID": 4, "LookupValue": "PAR"},
            {"CaseCategoryID": 8, "LookupValue": "Zero FIR"},
        ],
        "gravity_offence": [
            {"GravityOffenceID": 1, "LookupValue": "Non-Heinous"},
            {"GravityOffenceID": 2, "LookupValue": "Heinous"},
        ],
        "case_status_master": [
            {"CaseStatusID": 1, "CaseStatusName": "Registered"},
            {"CaseStatusID": 2, "CaseStatusName": "Under Investigation"},
            {"CaseStatusID": 3, "CaseStatusName": "Charge Sheeted"},
            {"CaseStatusID": 4, "CaseStatusName": "Closed"},
            {"CaseStatusID": 5, "CaseStatusName": "Undetected"},
            {"CaseStatusID": 6, "CaseStatusName": "False Case"},
        ],
        "occupation_master": [
            {"OccupationID": 1, "OccupationName": "Student"},
            {"OccupationID": 2, "OccupationName": "Farmer"},
            {"OccupationID": 3, "OccupationName": "Private Employee"},
            {"OccupationID": 4, "OccupationName": "Government Employee"},
            {"OccupationID": 5, "OccupationName": "Business"},
            {"OccupationID": 6, "OccupationName": "Labourer"},
            {"OccupationID": 7, "OccupationName": "Retired"},
            {"OccupationID": 8, "OccupationName": "Unknown"},
        ],
        "religion_master": [
            {"ReligionID": 1, "ReligionName": "Hindu"},
            {"ReligionID": 2, "ReligionName": "Muslim"},
            {"ReligionID": 3, "ReligionName": "Christian"},
            {"ReligionID": 4, "ReligionName": "Other"},
            {"ReligionID": 5, "ReligionName": "Not Stated"},
        ],
        "caste_master": [
            {"caste_master_id": 1, "caste_master_name": "General"},
            {"caste_master_id": 2, "caste_master_name": "OBC"},
            {"caste_master_id": 3, "caste_master_name": "SC"},
            {"caste_master_id": 4, "caste_master_name": "ST"},
            {"caste_master_id": 5, "caste_master_name": "Not Stated"},
        ],
    }


def generate_cases(tables, total_cases=900):
    station_units = tables["station_units"]
    employees_by_unit = defaultdict(list)
    for employee in tables["employee"]:
        employees_by_unit[employee["UnitID"]].append(employee)

    sub_heads = tables["crime_sub_head"]
    sub_head_by_id = {row["CrimeSubHeadID"]: row for row in sub_heads}
    section_by_sub_head = {
        row["CrimeHeadName"]: SECTION_MAP[row["CrimeHeadName"]]
        for row in sub_heads
        if row["CrimeHeadName"] in SECTION_MAP
    }
    serials = Counter()

    case_master = []
    complainants = []
    victims = []
    accused = []
    act_section_associations = []
    arrests = []
    arrest_accused = []
    chargesheets = []
    occurrence = []

    for case_id in range(1, total_cases + 1):
        station = random.choice(station_units)
        employees = employees_by_unit[station["UnitID"]]
        police_person = random.choice(employees)
        sub_head = random.choice(sub_heads)
        crime_name = sub_head["CrimeHeadName"]
        act_code, section_code, _ = section_by_sub_head[crime_name]
        incident_year = random.choice(list(YEARS))
        registered_dt = rand_dt(incident_year)
        incident_from = registered_dt - timedelta(hours=random.randint(2, 120), minutes=random.randint(0, 59))
        incident_to = incident_from + timedelta(minutes=random.randint(15, 240))
        info_received = incident_to + timedelta(minutes=random.randint(5, 180))
        lat, lng = jitter(station["Latitude"], station["Longitude"], 0.05)

        case_category_id = random.choices([1, 3, 4, 8], weights=[84, 5, 6, 5])[0]
        gravity_id = 2 if crime_name in {"Murder", "Kidnapping", "Sexual Assault", "Robbery", "Drug Trafficking"} else 1
        status_id = random.choices([1, 2, 3, 4, 5, 6], weights=[8, 35, 24, 18, 10, 5])[0]
        serial_key = (station["UnitID"], case_category_id, incident_year)
        serials[serial_key] += 1
        serial = serials[serial_key]
        crime_no = f"{CASE_CATEGORY_CODE[case_category_id]}{station['DistrictID']:04d}{station['UnitID']:04d}{incident_year}{serial:05d}"
        case_no = f"{incident_year}{serial:05d}"

        case_master.append({
            "CaseMasterID": case_id,
            "CrimeNo": crime_no,
            "CaseNo": case_no,
            "CrimeRegisteredDate": date_str(registered_dt),
            "PolicePersonID": police_person["EmployeeID"],
            "PoliceStationID": station["UnitID"],
            "CaseCategoryID": case_category_id,
            "GravityOffenceID": gravity_id,
            "CrimeMajorHeadID": sub_head["CrimeHeadID"],
            "CrimeMinorHeadID": sub_head["CrimeSubHeadID"],
            "CaseStatusID": status_id,
            "CourtID": station["DistrictID"],
            "IncidentFromDate": datetime_str(incident_from),
            "IncidentToDate": datetime_str(incident_to),
            "InfoReceivedPSDate": datetime_str(info_received),
            "latitude": lat,
            "longitude": lng,
            "BriefFacts": f"Masked FIR summary for {crime_name.lower()} case {case_id:04d}.",
        })

        occurrence.append({
            "OccuranceTimeID": case_id,
            "CaseMasterID": case_id,
            "FromDate": datetime_str(incident_from),
            "ToDate": datetime_str(incident_to),
            "PlaceOfOccurance": f"Beat-{(case_id % 18) + 1}",
            "latitude": lat,
            "longitude": lng,
        })

        complainant_count = random.choices([1, 2], weights=[92, 8])[0]
        for _ in range(complainant_count):
            cid = len(complainants) + 1
            complainants.append({
                "ComplainantID": cid,
                "CaseMasterID": case_id,
                "ComplainantName": f"CMP-{alpha_code(cid)}",
                "AgeYear": random.randint(18, 78),
                "OccupationID": random.randint(1, 8),
                "ReligionID": random.randint(1, 5),
                "CasteID": random.randint(1, 5),
                "GenderID": random.randint(1, 3),
            })

        victim_count = random.choices([1, 2, 3], weights=[78, 18, 4])[0]
        for _ in range(victim_count):
            vid = len(victims) + 1
            victims.append({
                "VictimMasterID": vid,
                "CaseMasterID": case_id,
                "VictimName": f"VIC-{alpha_code(vid)}",
                "AgeYear": random.randint(6, 82),
                "GenderID": random.randint(1, 3),
                "VictimPolice": 1 if random.random() < 0.03 else 0,
            })

        accused_count = random.choices([1, 2, 3, 4], weights=[58, 27, 11, 4])[0]
        case_accused_ids = []
        for acc_order in range(1, accused_count + 1):
            aid = len(accused) + 1
            case_accused_ids.append(aid)
            accused.append({
                "AccusedMasterID": aid,
                "CaseMasterID": case_id,
                "AccusedName": f"ACC-{alpha_code(aid)}",
                "AgeYear": random.randint(12, 75),
                "GenderID": random.randint(1, 3),
                "PersonID": f"A{acc_order}",
            })

        act_section_associations.append({
            "CaseMasterID": case_id,
            "ActID": act_code,
            "SectionID": section_code,
            "ActOrderID": 1,
            "SectionOrderID": 1,
        })

        if random.random() < 0.62:
            arrest_id = len(arrests) + 1
            arrest_dt = registered_dt + timedelta(days=random.randint(0, 120))
            io = random.choice(employees)
            arrests.append({
                "ArrestSurrenderID": arrest_id,
                "CaseMasterID": case_id,
                "ArrestSurrenderTypeID": random.choice([1, 2]),
                "ArrestSurrenderDate": date_str(arrest_dt),
                "ArrestSurrenderStateId": random.choices([1, 2, 3, 4], weights=[88, 5, 4, 3])[0],
                "ArrestSurrenderDistrictId": station["DistrictID"],
                "PoliceStationID": station["UnitID"],
                "IOID": io["EmployeeID"],
                "CourtID": station["DistrictID"],
                "AccusedMasterID": case_accused_ids[0],
                "IsAccused": 1,
                "IsComplainantAccused": 1 if random.random() < 0.02 else 0,
            })
            for aid in case_accused_ids:
                arrest_accused.append({
                    "ArrestSurrenderAccusedID": len(arrest_accused) + 1,
                    "ArrestSurrenderID": arrest_id,
                    "AccusedMasterID": aid,
                })

        if status_id in {3, 4, 6}:
            chargesheets.append({
                "CSID": len(chargesheets) + 1,
                "CaseMasterID": case_id,
                "csdate": datetime_str(registered_dt + timedelta(days=random.randint(30, 240))),
                "cstype": random.choice(["A", "A", "A", "B", "C"]),
                "PolicePersonID": police_person["EmployeeID"],
            })

    return {
        "case_master": case_master,
        "complainant_details": complainants,
        "victim": victims,
        "accused": accused,
        "act_section_association": act_section_associations,
        "arrest_surrender": arrests,
        "inv_arrestsurrenderaccused": arrest_accused,
        "chargesheet_details": chargesheets,
        "inv_occurance_time": occurrence,
    }


def clear_old_csvs():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    for path in DATA_DIR.glob("*.csv"):
        path.unlink()


def main():
    clear_old_csvs()
    tables = build_static_tables()
    tables.update(generate_cases(tables))

    outputs = [
        ("state", "State.csv", ["StateID", "StateName", "NationalityID", "Active"]),
        ("district", "District.csv", ["DistrictID", "DistrictName", "StateID", "Active"]),
        ("unit_type", "UnitType.csv", ["UnitTypeID", "UnitTypeName", "CityDistState", "Hierarchy", "Active"]),
        ("unit", "Unit.csv", ["UnitID", "UnitName", "TypeID", "ParentUnit", "NationalityID", "StateID", "DistrictID", "Active"]),
        ("rank", "Rank.csv", ["RankID", "RankName", "Hierarchy", "Active"]),
        ("designation", "Designation.csv", ["DesignationID", "DesignationName", "Active", "SortOrder"]),
        ("employee", "Employee.csv", ["EmployeeID", "DistrictID", "UnitID", "RankID", "DesignationID", "KGID", "FirstName", "EmployeeDOB", "GenderID", "BloodGroupID", "PhysicallyChallenged", "AppointmentDate"]),
        ("court", "Court.csv", ["CourtID", "CourtName", "DistrictID", "StateID", "Active"]),
        ("case_category", "CaseCategory.csv", ["CaseCategoryID", "LookupValue"]),
        ("gravity_offence", "GravityOffence.csv", ["GravityOffenceID", "LookupValue"]),
        ("case_status_master", "CaseStatusMaster.csv", ["CaseStatusID", "CaseStatusName"]),
        ("occupation_master", "OccupationMaster.csv", ["OccupationID", "OccupationName"]),
        ("religion_master", "ReligionMaster.csv", ["ReligionID", "ReligionName"]),
        ("caste_master", "CasteMaster.csv", ["caste_master_id", "caste_master_name"]),
        ("crime_head", "CrimeHead.csv", ["CrimeHeadID", "CrimeGroupName", "Active"]),
        ("crime_sub_head", "CrimeSubHead.csv", ["CrimeSubHeadID", "CrimeHeadID", "CrimeHeadName", "SeqID"]),
        ("act", "Act.csv", ["ActCode", "ActDescription", "ShortName", "Active"]),
        ("section", "Section.csv", ["ActCode", "SectionCode", "SectionDescription", "Active"]),
        ("crime_head_act_section", "CrimeHeadActSection.csv", ["CrimeHeadID", "ActCode", "SectionCode"]),
        ("case_master", "CaseMaster.csv", ["CaseMasterID", "CrimeNo", "CaseNo", "CrimeRegisteredDate", "PolicePersonID", "PoliceStationID", "CaseCategoryID", "GravityOffenceID", "CrimeMajorHeadID", "CrimeMinorHeadID", "CaseStatusID", "CourtID", "IncidentFromDate", "IncidentToDate", "InfoReceivedPSDate", "latitude", "longitude", "BriefFacts"]),
        ("complainant_details", "ComplainantDetails.csv", ["ComplainantID", "CaseMasterID", "ComplainantName", "AgeYear", "OccupationID", "ReligionID", "CasteID", "GenderID"]),
        ("victim", "Victim.csv", ["VictimMasterID", "CaseMasterID", "VictimName", "AgeYear", "GenderID", "VictimPolice"]),
        ("accused", "Accused.csv", ["AccusedMasterID", "CaseMasterID", "AccusedName", "AgeYear", "GenderID", "PersonID"]),
        ("act_section_association", "ActSectionAssociation.csv", ["CaseMasterID", "ActID", "SectionID", "ActOrderID", "SectionOrderID"]),
        ("inv_occurance_time", "Inv_OccuranceTime.csv", ["OccuranceTimeID", "CaseMasterID", "FromDate", "ToDate", "PlaceOfOccurance", "latitude", "longitude"]),
        ("arrest_surrender", "ArrestSurrender.csv", ["ArrestSurrenderID", "CaseMasterID", "ArrestSurrenderTypeID", "ArrestSurrenderDate", "ArrestSurrenderStateId", "ArrestSurrenderDistrictId", "PoliceStationID", "IOID", "CourtID", "AccusedMasterID", "IsAccused", "IsComplainantAccused"]),
        ("inv_arrestsurrenderaccused", "inv_arrestsurrenderaccused.csv", ["ArrestSurrenderAccusedID", "ArrestSurrenderID", "AccusedMasterID"]),
        ("chargesheet_details", "ChargesheetDetails.csv", ["CSID", "CaseMasterID", "csdate", "cstype", "PolicePersonID"]),
    ]
    for key, filename, fieldnames in outputs:
        write_csv(filename, tables[key], fieldnames)


if __name__ == "__main__":
    main()
