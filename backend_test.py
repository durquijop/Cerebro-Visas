#!/usr/bin/env python3
"""
Backend test for document upload async pipeline
Tests the bug fixes in upload-async/route.js and case-miner.js
"""

import requests
import json
import time
import os
from pathlib import Path

def load_env_vars():
    """Load environment variables from .env file"""
    env_path = Path('/app/.env')
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                if line.strip() and not line.startswith('#') and '=' in line:
                    key, value = line.strip().split('=', 1)
                    os.environ[key] = value

# Load environment variables
load_env_vars()

# Configuration
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://cerebro-visas-2.preview.emergentagent.com')
UPLOAD_ENDPOINT = f"{BASE_URL}/api/documents/upload-async"
TIMEOUT = 120  # 2 minutes timeout for full processing

def create_test_file():
    """Create a test RFE document with realistic content"""
    rfe_content = """
REQUEST FOR EVIDENCE

Service Center: Texas Service Center
Receipt Number: MSC123456789
Beneficiary: John Doe
Petitioner: Tech Corp USA

Dear Petitioner:

This refers to the Form I-140, Immigrant Petition for Alien Worker, filed on behalf of the above-named beneficiary. The petitioner has not established that the proposed endeavor has both substantial merit and national importance under Prong 1 of the Dhanasar framework. 

The evidence submitted does not sufficiently demonstrate that the beneficiary's work in artificial intelligence and machine learning algorithms will have a meaningful impact beyond the immediate field. While the petitioner has provided letters of support and publications, these do not adequately establish the national scope of the proposed endeavor.

Additionally, the evidence does not establish that the beneficiary is well positioned to advance the proposed endeavor under Prong 2. The petitioner must provide additional evidence demonstrating:

1. Evidence of the beneficiary's leadership role in the field of AI research
2. Documentation showing how the beneficiary's work has been adopted by other researchers
3. Letters from independent experts who can attest to the significance of the beneficiary's contributions

Furthermore, under Prong 3, the petitioner has not demonstrated that it would be beneficial to the United States to waive the requirements of a job offer and labor certification. The evidence must show that the national interest in the beneficiary's work is so great that requiring the normal process would be contrary to the national interest.

You have 87 days from the date of this notice to respond. Failure to respond within this time period may result in denial of the petition.

Sincerely,
Immigration Officer
Texas Service Center
    """.strip()
    
    test_file = Path("/tmp/test_rfe_document.txt")
    test_file.write_text(rfe_content, encoding='utf-8')
    print(f"✓ Created test file: {test_file} ({len(rfe_content)} chars)")
    return test_file

def test_upload_endpoint():
    """Test POST /api/documents/upload-async"""
    print("\n🧪 Testing POST /api/documents/upload-async")
    
    # Create test file
    test_file = create_test_file()
    
    try:
        with open(test_file, 'rb') as f:
            files = {'file': (test_file.name, f, 'text/plain')}
            data = {
                'docType': 'RFE',
                'processWithAI': 'true'
            }
            
            print(f"   📤 Uploading to: {UPLOAD_ENDPOINT}")
            response = requests.post(UPLOAD_ENDPOINT, files=files, data=data, timeout=30)
            
            print(f"   Status: {response.status_code}")
            print(f"   Response: {response.text}")
            
            if response.status_code != 200:
                print(f"❌ Upload failed with status {response.status_code}")
                return None
            
            result = response.json()
            if not result.get('success') or not result.get('jobId'):
                print(f"❌ Upload response missing jobId: {result}")
                return None
            
            job_id = result['jobId']
            print(f"✅ Upload successful, jobId: {job_id}")
            return job_id
            
    except Exception as e:
        print(f"❌ Upload error: {str(e)}")
        return None
    finally:
        # Clean up test file
        if test_file.exists():
            test_file.unlink()

def test_status_polling(job_id):
    """Test GET /api/documents/upload-async?jobId={jobId} polling"""
    print(f"\n🔍 Testing status polling for job {job_id}")
    
    status_url = f"{UPLOAD_ENDPOINT}?jobId={job_id}"
    start_time = time.time()
    last_status = None
    
    while time.time() - start_time < TIMEOUT:
        try:
            response = requests.get(status_url, timeout=10)
            
            if response.status_code != 200:
                print(f"❌ Status polling failed: {response.status_code}")
                print(f"   Response: {response.text}")
                return None
            
            job_status = response.json()
            current_status = job_status.get('status')
            progress = job_status.get('progress', 0)
            
            # Only print if status changed
            if current_status != last_status:
                print(f"   Status: {current_status} ({progress}%)")
                if job_status.get('message'):
                    print(f"   Message: {job_status.get('message')}")
                last_status = current_status
            
            # Check if completed
            if current_status == 'completed':
                print("✅ Job completed successfully!")
                return job_status
            elif current_status == 'failed':
                error_msg = job_status.get('error', 'Unknown error')
                print(f"❌ Job failed: {error_msg}")
                return job_status
            
            # Wait before next poll
            time.sleep(3)
            
        except Exception as e:
            print(f"❌ Polling error: {str(e)}")
            time.sleep(5)
    
    print(f"❌ Job timed out after {TIMEOUT} seconds")
    return None

def verify_extraction_results(job_status):
    """Verify that the structured data extraction worked correctly"""
    print("\n📊 Verifying extraction results")
    
    if not job_status or job_status.get('status') != 'completed':
        print("❌ Job not completed, cannot verify results")
        return False
    
    result = job_status.get('result', {})
    issues_count = result.get('issuesCount', 0)
    requests_count = result.get('requestsCount', 0)
    
    print(f"   Issues found: {issues_count}")
    print(f"   Requests found: {requests_count}")
    print(f"   Text length: {result.get('textLength', 0)}")
    print(f"   Extraction method: {result.get('extractionMethod', 'unknown')}")
    
    # The key fix: issuesCount and requestsCount should be > 0
    # This was the bug - extractStructuredData() returns {success, data, visaType} 
    # but the code was looking for issues/requests at top level instead of in .data
    success = True
    
    if issues_count <= 0:
        print("❌ CRITICAL: No issues found - Bug 1 may not be fixed properly")
        success = False
    else:
        print("✅ Issues found - Bug 1 appears to be fixed")
    
    if requests_count <= 0:
        print("❌ CRITICAL: No requests found - Bug 1 may not be fixed properly")
        success = False
    else:
        print("✅ Requests found - Bug 1 appears to be fixed")
    
    # Check if text extraction worked
    if result.get('textLength', 0) < 200:
        print("❌ WARNING: Text extraction may have failed")
        success = False
    else:
        print("✅ Text extraction successful")
    
    return success

def test_llm_config():
    """Test that the LLM configuration is working with OpenRouter"""
    print("\n🤖 Testing LLM configuration")
    
    # Check environment variables
    openrouter_key = os.getenv('OPENROUTER_API_KEY')
    openai_key = os.getenv('OPENAI_API_KEY')
    
    if openrouter_key:
        print("✅ OPENROUTER_API_KEY found in environment")
    else:
        print("❌ OPENROUTER_API_KEY missing")
    
    if openai_key:
        print("✅ OPENAI_API_KEY found in environment (fallback)")
    else:
        print("⚠️ OPENAI_API_KEY missing (fallback)")
    
    # The actual LLM test happens during document processing
    print("   LLM functionality will be tested during document processing")
    
    return openrouter_key is not None or openai_key is not None

def main():
    """Main test function"""
    print("🏁 Starting Document Upload Async Pipeline Test")
    print(f"   Base URL: {BASE_URL}")
    print(f"   Timeout: {TIMEOUT} seconds")
    
    all_tests_passed = True
    
    try:
        # Test 1: LLM Config
        if not test_llm_config():
            print("❌ LLM configuration test failed")
            all_tests_passed = False
        
        # Test 2: Upload endpoint
        job_id = test_upload_endpoint()
        if not job_id:
            print("❌ Upload test failed")
            all_tests_passed = False
            return
        
        # Test 3: Status polling
        final_status = test_status_polling(job_id)
        if not final_status:
            print("❌ Status polling test failed")
            all_tests_passed = False
            return
        
        # Test 4: Verify extraction results (the key bug fix)
        if not verify_extraction_results(final_status):
            print("❌ Extraction results verification failed")
            all_tests_passed = False
        
        # Summary
        print("\n" + "="*60)
        if all_tests_passed:
            print("🎉 ALL TESTS PASSED")
            print("✅ Bug 1 (structured data mapping) appears to be fixed")
            print("✅ Bug 2 (OpenRouter migration) appears to be working")
            print("✅ Async pipeline is functioning correctly")
        else:
            print("❌ SOME TESTS FAILED")
            print("   Check the output above for specific issues")
        print("="*60)
        
    except KeyboardInterrupt:
        print("\n⚠️ Test interrupted by user")
    except Exception as e:
        print(f"\n❌ Test failed with exception: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()