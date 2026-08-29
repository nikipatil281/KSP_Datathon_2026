-- KSP Crime Analytics - Catalyst Data Store Schema
-- Import this into Cloud Scale -> Data Store for the search assistant tables.

CREATE TABLE IF NOT EXISTS districts (
    district_id INT PRIMARY KEY,
    name VARCHAR(100),
    latitude DECIMAL(10,6),
    longitude DECIMAL(10,6),
    population INT,
    urbanization_index DECIMAL(5,2),
    socio_economic_index DECIMAL(5,2),
    area_sqkm INT,
    literacy_rate DECIMAL(5,2),
    unemployment_rate DECIMAL(5,2)
);

CREATE TABLE IF NOT EXISTS police_stations (
    station_id INT PRIMARY KEY,
    district_id INT,
    name VARCHAR(150),
    latitude DECIMAL(10,6),
    longitude DECIMAL(10,6),
    officer_count INT,
    area_covered_sqkm INT
);

CREATE TABLE IF NOT EXISTS crime_types (
    crime_type_id INT PRIMARY KEY,
    crime_type VARCHAR(80),
    default_severity INT,
    category VARCHAR(80)
);

CREATE TABLE IF NOT EXISTS modus_operandi (
    modus_operandi_id INT PRIMARY KEY,
    crime_type_id INT,
    modus_operandi VARCHAR(160)
);

CREATE TABLE IF NOT EXISTS location_types (
    location_type_id INT PRIMARY KEY,
    location_type VARCHAR(80)
);

CREATE TABLE IF NOT EXISTS weapons (
    weapon_id INT PRIMARY KEY,
    weapon_name VARCHAR(80)
);

CREATE TABLE IF NOT EXISTS case_statuses (
    case_status_id INT PRIMARY KEY,
    status_name VARCHAR(80)
);

CREATE TABLE IF NOT EXISTS education_levels (
    education_id INT PRIMARY KEY,
    education_level VARCHAR(80)
);

CREATE TABLE IF NOT EXISTS occupations (
    occupation_id INT PRIMARY KEY,
    occupation_name VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS gangs (
    gang_id INT PRIMARY KEY,
    gang_name VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS offender_statuses (
    offender_status_id INT PRIMARY KEY,
    status_name VARCHAR(80)
);

CREATE TABLE IF NOT EXISTS relationship_types (
    relationship_type_id INT PRIMARY KEY,
    relationship_type VARCHAR(80)
);

CREATE TABLE IF NOT EXISTS offenders (
    offender_id INT PRIMARY KEY,
    name VARCHAR(120),
    alias VARCHAR(80),
    age INT,
    gender VARCHAR(20),
    district_of_origin VARCHAR(100),
    education VARCHAR(80),
    occupation VARCHAR(100),
    known_associates VARCHAR(500),
    prior_convictions INT,
    gang_affiliation VARCHAR(100),
    status VARCHAR(80),
    aadhar_linked BIT,
    risk_score DECIMAL(5,2),
    district_of_origin_id INT,
    education_id INT,
    occupation_id INT,
    gang_id INT,
    offender_status_id INT,
    birth_year INT
);

CREATE TABLE IF NOT EXISTS victims (
    victim_id INT PRIMARY KEY,
    name VARCHAR(120),
    age INT,
    gender VARCHAR(20),
    occupation VARCHAR(100),
    district VARCHAR(100),
    repeat_victim BIT,
    vulnerability_index DECIMAL(5,2),
    district_id INT,
    occupation_id INT
);

CREATE TABLE IF NOT EXISTS officers (
    officer_id INT PRIMARY KEY,
    officer_code VARCHAR(40),
    initials VARCHAR(20),
    rank VARCHAR(80),
    badge_number VARCHAR(40),
    station_id INT,
    district_id INT,
    specialization_crime_type_id INT,
    specialization VARCHAR(100),
    shift VARCHAR(40),
    status VARCHAR(40),
    current_case_load INT,
    years_of_service INT
);

CREATE TABLE IF NOT EXISTS crimes (
    crime_id INT PRIMARY KEY,
    station_id INT,
    district VARCHAR(100),
    crime_type VARCHAR(80),
    modus_operandi VARCHAR(160),
    incident_date DATE,
    incident_time VARCHAR(20),
    incident_year INT,
    incident_month INT,
    incident_day_of_week VARCHAR(20),
    incident_hour INT,
    latitude DECIMAL(10,6),
    longitude DECIMAL(10,6),
    location_type VARCHAR(80),
    severity INT,
    weapons_used VARCHAR(100),
    property_loss_inr INT,
    status VARCHAR(80),
    fir_number VARCHAR(60),
    io_officer VARCHAR(120),
    offender_ids VARCHAR(500),
    victim_ids VARCHAR(500),
    solved BIT,
    days_to_solve INT,
    district_id INT,
    crime_type_id INT,
    modus_operandi_id INT,
    location_type_id INT,
    weapon_id INT,
    case_status_id INT,
    io_officer_id INT
);

CREATE TABLE IF NOT EXISTS crime_offenders (
    crime_offender_id INT PRIMARY KEY,
    crime_id INT,
    offender_id INT,
    role VARCHAR(80)
);

CREATE TABLE IF NOT EXISTS crime_victims (
    crime_victim_id INT PRIMARY KEY,
    crime_id INT,
    victim_id INT,
    role VARCHAR(80)
);

CREATE TABLE IF NOT EXISTS crime_officers (
    crime_officer_id INT PRIMARY KEY,
    crime_id INT,
    officer_id INT,
    role VARCHAR(80),
    assigned_date DATE,
    assignment_status VARCHAR(80)
);

CREATE TABLE IF NOT EXISTS associations (
    association_id INT PRIMARY KEY,
    offender_id_a INT,
    offender_id_b INT,
    relationship_type VARCHAR(80),
    strength DECIMAL(5,2),
    first_seen_crime_id INT,
    relationship_type_id INT
);

CREATE TABLE IF NOT EXISTS monthly_stats (
    stat_id INT PRIMARY KEY,
    district VARCHAR(100),
    incident_year INT,
    incident_month INT,
    crime_type VARCHAR(80),
    incident_count INT,
    solved_count INT,
    total_property_loss_inr INT,
    solve_rate DECIMAL(5,2),
    district_id INT,
    crime_type_id INT
);
