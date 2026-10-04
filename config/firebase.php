<?php
/**
 * ==============================================================================
 * AirSense - Firebase Configuration & 4-Room Sensor Mapping
 * ==============================================================================
 * Central configuration for Firebase Realtime Database parameters and 
 * 4 office rooms mapped to sensor1, sensor2, sensor3, sensor4.
 */

return [
    'apiKey'            => 'AIzaSyCBHaLqf5MqXBCJPsU1BJwqM6P2mi6AU-w',
    'authDomain'        => 'airsense-ba372.firebaseapp.com',
    'databaseURL'       => 'https://airsense-ba372-default-rtdb.asia-southeast1.firebasedatabase.app',
    'projectId'         => 'airsense-ba372',
    'storageBucket'     => 'airsense-ba372.firebasestorage.app',
    'messagingSenderId' => '409387199979',
    'appId'             => '1:409387199979:web:8efa7cbb7c631f6a84bdae',
    
    // Sensor Database Path Mapping
    'defaultSensor'     => 'sensor1',
    'sensorsPath'       => '/sensors/',
    'historyPath'       => '/history/',
    
    // 4 Office Rooms Mapping (sensor1 active, sensor2-4 expansion ready)
    'activeUnits'       => [
        'sensor1' => [
            'id'       => 'sensor1',
            'name'     => 'Room 1',
            'label'    => 'Office AC Unit 1',
            'hardware' => 'ESP32 + PMS5003',
            'last_cleaned' => null, // Will display "Cleaning date not recorded" unless saved
            'next_schedule' => null
        ],
        'sensor2' => [
            'id'       => 'sensor2',
            'name'     => 'Room 2',
            'label'    => 'Office AC Unit 2',
            'hardware' => 'ESP32 + PMS5003',
            'last_cleaned' => null,
            'next_schedule' => null
        ],
        'sensor3' => [
            'id'       => 'sensor3',
            'name'     => 'Room 3',
            'label'    => 'Office AC Unit 3',
            'hardware' => 'ESP32 + PMS5003',
            'last_cleaned' => null,
            'next_schedule' => null
        ],
        'sensor4' => [
            'id'       => 'sensor4',
            'name'     => 'Room 4',
            'label'    => 'Office AC Unit 4',
            'hardware' => 'ESP32 + PMS5003',
            'last_cleaned' => null,
            'next_schedule' => null
        ]
    ]
];
