#!/usr/bin/env node
/**
 * Test script to verify Plant.id API integration
 * Shows exact disease detection response from backend
 */

const http = require('http');

// Sample test image (base64 encoded small leaf photo - a synthetic placeholder)
// In real usage, this would be a real crop leaf photo
const sampleImageBase64 = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8VAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA+AAA/9k=';

async function testPlantIdIntegration() {
  console.log('🌾 Testing Plant.id API Integration\n');
  console.log('API Key Status:', process.env.PLANT_ID_API_KEY ? `✓ Set (${process.env.PLANT_ID_API_KEY.substring(0, 20)}...)` : '✗ NOT SET');
  console.log('Backend URL: http://localhost:5173/api/diseases/detect\n');
  console.log('Sending test request...\n');

  const payload = {
    imageBase64: `data:image/jpeg;base64,${sampleImageBase64}`,
    crop: 'Rice',
    language: 'en',
  };

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);

    const options = {
      hostname: 'localhost',
      port: 5173,
      path: '/api/diseases/detect',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);

          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('📊 EXACT DISEASE DETECTION RESULT');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

          if (response.result) {
            console.log('✓ Provider:', response.provider);
            if (response.warning) {
              console.log('⚠ Warning:', response.warning);
            }
            console.log('\n📋 Result Details:');
            console.log('  Disease:', response.result.disease);
            console.log('  Confidence:', response.result.confidence + '%');
            console.log('  Advisory (EN):', response.result.advisory_en);
            console.log('  Advisory (BN):', response.result.advisory_bn);
            console.log('  Treatment (EN):', response.result.treatment_en);
            console.log('  Treatment (BN):', response.result.treatment_bn);
            console.log('  Prevention (EN):', response.result.prevention_en);
            console.log('  Prevention (BN):', response.result.prevention_bn);
          }

          if (response.raw) {
            console.log('\n🔧 Raw Plant.id API Response:');
            console.log(JSON.stringify(response.raw, null, 2));
          }

          console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          resolve(response);
        } catch (e) {
          reject(new Error('Failed to parse response: ' + e.message));
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

testPlantIdIntegration()
  .then((result) => {
    console.log('✓ Test completed successfully!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('✗ Test failed:', error.message);
    console.error('\nMake sure:');
    console.error('  1. Dev server is running (npm run dev)');
    console.error('  2. PLANT_ID_API_KEY environment variable is set');
    console.error('  3. You have internet connection to reach Plant.id API');
    process.exit(1);
  });
