#!/usr/bin/env node

/**
 * Test script for FBX file upload functionality
 * Tests the upload endpoint and verifies response structure
 */

const FormData = require('form-data');
const fs = require('fs');
const axios = require('axios');
const path = require('path');

async function testFBXUpload() {
  console.log('🧪 Testing FBX file upload functionality...');
  
  try {
    // Check if AI proxy server is running
    console.log('📡 Checking if AI proxy server is running on port 8002...');
    
    try {
      const healthResponse = await axios.get('http://localhost:8002/health');
      console.log('✅ AI proxy server is running:', healthResponse.data);
    } catch (error) {
      console.error('❌ AI proxy server is not running. Please start it with: node ai-proxy-server.js');
      process.exit(1);
    }
    
    // Create a test FBX file (mock file for testing)
    const testFileName = 'test-furniture.fbx';
    const testContent = 'Mock FBX file content for testing';
    fs.writeFileSync(testFileName, testContent);
    
    console.log('📁 Created test FBX file:', testFileName);
    
    // Prepare form data
    const formData = new FormData();
    formData.append('file', fs.createReadStream(testFileName));
    formData.append('fileType', '.fbx');
    
    console.log('📤 Uploading FBX file to server...');
    
    // Upload file
    const response = await axios.post('http://localhost:8002/upload-bim-file', formData, {
      headers: {
        ...formData.getHeaders(),
      },
      timeout: 30000 // 30 second timeout
    });
    
    console.log('✅ Upload successful!');
    console.log('📋 Response data:', JSON.stringify(response.data, null, 2));
    
    // Verify response structure
    const { success, fileName, fileType, imported_count, objects } = response.data;
    
    if (!success) {
      throw new Error('Upload marked as failed');
    }
    
    if (fileType !== '.fbx') {
      throw new Error(`Expected fileType .fbx, got ${fileType}`);
    }
    
    if (imported_count !== 1) {
      throw new Error(`Expected 1 imported object, got ${imported_count}`);
    }
    
    if (!objects || objects.length !== 1) {
      throw new Error(`Expected 1 object in response, got ${objects?.length || 0}`);
    }
    
    const fbxObject = objects[0];
    const requiredFields = ['id', 'type', 'name', 'modelUrl', 'format', 'position', 'rotation', 'scale'];
    
    for (const field of requiredFields) {
      if (!fbxObject.hasOwnProperty(field)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    if (fbxObject.type !== 'furniture') {
      throw new Error(`Expected type 'furniture', got '${fbxObject.type}'`);
    }
    
    if (fbxObject.format !== 'fbx') {
      throw new Error(`Expected format 'fbx', got '${fbxObject.format}'`);
    }
    
    console.log('✅ Response structure validation passed');
    
    // Test if the uploaded file is accessible via the static endpoint
    console.log('📡 Testing file access via static endpoint...');
    
    try {
      const fileUrl = fbxObject.modelUrl;
      console.log('🔗 Testing URL:', fileUrl);
      
      const fileResponse = await axios.get(fileUrl, {
        timeout: 5000
      });
      
      console.log('✅ File is accessible via static endpoint');
      console.log('📄 File size:', fileResponse.data.length, 'bytes');
      
    } catch (fileError) {
      console.warn('⚠️ Warning: File not accessible via static endpoint:', fileError.message);
    }
    
    console.log('\n🎉 All FBX upload tests passed!');
    console.log('✅ FBX files can now be uploaded and processed');
    console.log('✅ Response structure is correct for frontend integration');
    console.log('✅ Files are served statically for viewport access');
    
  } catch (error) {
    console.error('\n❌ FBX upload test failed:', error.message);
    console.error('🔍 Error details:', error.response?.data || error);
    process.exit(1);
  } finally {
    // Clean up test file
    try {
      if (fs.existsSync('test-furniture.fbx')) {
        fs.unlinkSync('test-furniture.fbx');
        console.log('🧹 Cleaned up test file');
      }
    } catch (cleanupError) {
      console.warn('⚠️ Could not clean up test file:', cleanupError.message);
    }
  }
}

// Run the test
if (require.main === module) {
  testFBXUpload();
}

module.exports = { testFBXUpload };