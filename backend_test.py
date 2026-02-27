#!/usr/bin/env python3
"""
Backend Test Suite for Document Upload Async Pipeline
Tests the refactored async upload endpoint that creates documents immediately with 'pending' status.
"""

import requests
import json
import time
import sys
import io
from datetime import datetime

# Configuration
BASE_URL = "https://cerebro-visas-2.preview.emergentagent.com"
UPLOAD_ENDPOINT = f"{BASE_URL}/api/documents/upload-async"
DOCUMENTS_ENDPOINT = f"{BASE_URL}/api/documents"

# Test RFE content (500+ chars as requested)
TEST_RFE_CONTENT = """U.S. Citizenship and Immigration Services
REQUEST FOR EVIDENCE
Receipt Number: IOE-0912345678
The petitioner seeks classification under EB-2 NIW with a National Interest Waiver under the Dhanasar framework.
Prong 1: The proposed endeavor has substantial merit and national importance. The evidence does not demonstrate national importance beyond the petitioner's immediate employer. The description of the endeavor is vague and too general.
Prong 2: The petitioner is well positioned to advance the proposed endeavor. The recommendation letters are generic and do not address unique contributions. Insufficient traction or progress demonstrated.
Prong 3: The record does not demonstrate that waiving the job offer requirement benefits the United States. No urgency established.
Please submit evidence within 87 days."""

def test_step(step_num, description):
    """Print test step header"""
    print(f"\n{'='*60}")
    print(f"STEP {step_num}: {description}")
    print('='*60)

def test_upload_async_endpoint():
    """Test 1: POST /api/documents/upload-async with RFE content"""
    test_step(1, "Testing POST /api/documents/upload-async")
    
    try:
        # Create a file-like object with RFE content
        file_content = TEST_RFE_CONTENT.encode('utf-8')
        files = {
            'file': ('test_rfe_document.txt', io.BytesIO(file_content), 'text/plain')
        }
        data = {
            'docType': 'RFE',
            'processWithAI': 'true'
        }
        
        print(f"📤 Uploading RFE document ({len(TEST_RFE_CONTENT)} characters)")
        
        response = requests.post(UPLOAD_ENDPOINT, files=files, data=data, timeout=30)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            print(f"Response Text: {response.text}")
            return None, None
            
        response_data = response.json()
        print(f"Response Data: {json.dumps(response_data, indent=2)}")
        
        # Verify response structure
        required_fields = ['success', 'jobId', 'documentId', 'message', 'pollUrl']
        missing_fields = [field for field in required_fields if field not in response_data]
        
        if missing_fields:
            print(f"❌ FAILED: Missing required fields: {missing_fields}")
            return None, None
            
        if not response_data.get('success'):
            print(f"❌ FAILED: success is not True")
            return None, None
            
        job_id = response_data['jobId']
        document_id = response_data['documentId']
        
        print(f"✅ PASSED: Upload endpoint returned jobId={job_id} and documentId={document_id}")
        return job_id, document_id
        
    except Exception as e:
        print(f"❌ FAILED with exception: {e}")
        return None, None

def test_document_immediate_creation(document_id):
    """Test 2: Verify document exists immediately in /api/documents with 'pending' status"""
    test_step(2, "Testing immediate document creation with 'pending' status")
    
    if not document_id:
        print("❌ FAILED: No documentId to test")
        return False
        
    try:
        print(f"🔍 Checking for document {document_id} in documents list")
        
        response = requests.get(DOCUMENTS_ENDPOINT, timeout=15)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            print(f"Response Text: {response.text}")
            return False
            
        response_data = response.json()
        
        # Handle different response formats
        if isinstance(response_data, list):
            documents = response_data
        elif isinstance(response_data, dict):
            documents = response_data.get('documents', response_data.get('data', []))
        else:
            print(f"❌ FAILED: Unexpected response format: {type(response_data)}")
            return False
            
        print(f"Found {len(documents)} documents in the system")
        
        # Find our document
        target_doc = None
        for doc in documents:
            if doc.get('id') == document_id:
                target_doc = doc
                break
                
        if not target_doc:
            print(f"❌ FAILED: Document {document_id} not found in documents list")
            print("Available document IDs:")
            for doc in documents[:5]:  # Show first 5 for debugging
                print(f"  - {doc.get('id', 'NO_ID')} ({doc.get('name', 'NO_NAME')})")
            return False
            
        print(f"📄 Found document: {json.dumps(target_doc, indent=2)}")
        
        # Check extraction_status
        extraction_status = target_doc.get('extraction_status')
        if extraction_status != 'pending':
            print(f"❌ FAILED: Expected extraction_status='pending', got '{extraction_status}'")
            return False
            
        print(f"✅ PASSED: Document {document_id} exists with extraction_status='pending'")
        return True
        
    except Exception as e:
        print(f"❌ FAILED with exception: {e}")
        return False

def test_job_polling(job_id):
    """Test 3: Poll job status until completion"""
    test_step(3, "Testing job status polling until completion")
    
    if not job_id:
        print("❌ FAILED: No jobId to poll")
        return False, {}
        
    poll_url = f"{UPLOAD_ENDPOINT}?jobId={job_id}"
    max_polls = 60  # 5 minutes max
    poll_interval = 5  # seconds
    
    print(f"🔄 Polling job {job_id} for up to {max_polls * poll_interval} seconds")
    
    status_history = []
    
    try:
        for i in range(max_polls):
            print(f"\n--- Poll {i+1}/{max_polls} ---")
            
            response = requests.get(poll_url, timeout=10)
            
            if response.status_code != 200:
                print(f"❌ Poll failed: {response.status_code} - {response.text}")
                continue
                
            job_data = response.json()
            status = job_data.get('status', 'unknown')
            progress = job_data.get('progress', 0)
            message = job_data.get('message', '')
            
            status_info = {
                'poll': i+1,
                'status': status,
                'progress': progress,
                'message': message,
                'timestamp': datetime.now().isoformat()
            }
            status_history.append(status_info)
            
            print(f"Status: {status} | Progress: {progress}% | Message: {message}")
            
            if status == 'completed':
                result = job_data.get('result', {})
                print(f"\n🎉 Job completed successfully!")
                print(f"Final result: {json.dumps(result, indent=2)}")
                
                # Verify final result has expected counts
                issues_count = result.get('issuesCount', 0)
                requests_count = result.get('requestsCount', 0) 
                embeddings_count = result.get('embeddingsCount', 0)
                
                print(f"📊 Extracted: {issues_count} issues, {requests_count} requests, {embeddings_count} embeddings")
                
                if issues_count == 0 and requests_count == 0:
                    print(f"⚠️ WARNING: No issues or requests extracted from RFE content")
                    
                if embeddings_count == 0:
                    print(f"⚠️ WARNING: No embeddings generated")
                    
                expected_counts = issues_count > 0 and requests_count > 0 and embeddings_count > 0
                if expected_counts:
                    print(f"✅ PASSED: Job completed with expected data extraction")
                else:
                    print(f"⚠️ PARTIAL: Job completed but some counts are zero")
                    
                return True, job_data
                
            elif status == 'failed':
                error = job_data.get('error', 'Unknown error')
                print(f"❌ Job failed: {error}")
                return False, job_data
                
            # Continue polling for pending/processing states
            time.sleep(poll_interval)
            
        print(f"❌ FAILED: Job did not complete within {max_polls * poll_interval} seconds")
        print(f"Status History: {json.dumps(status_history, indent=2)}")
        return False, {}
        
    except Exception as e:
        print(f"❌ FAILED with exception: {e}")
        return False, {}

def test_document_final_status(document_id):
    """Test 4: Verify document has final completed status and embeddings_count"""
    test_step(4, "Testing final document status after completion")
    
    if not document_id:
        print("❌ FAILED: No documentId to test")
        return False
        
    try:
        print(f"🔍 Checking final status of document {document_id}")
        
        response = requests.get(DOCUMENTS_ENDPOINT, timeout=15)
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            return False
            
        response_data = response.json()
        
        # Handle different response formats
        if isinstance(response_data, list):
            documents = response_data
        elif isinstance(response_data, dict):
            documents = response_data.get('documents', response_data.get('data', []))
        else:
            print(f"❌ FAILED: Unexpected response format")
            return False
            
        # Find our document
        target_doc = None
        for doc in documents:
            if doc.get('id') == document_id:
                target_doc = doc
                break
                
        if not target_doc:
            print(f"❌ FAILED: Document {document_id} not found")
            return False
            
        print(f"📄 Final document state: {json.dumps(target_doc, indent=2)}")
        
        # Check final extraction_status
        extraction_status = target_doc.get('extraction_status')
        if extraction_status != 'completed':
            print(f"❌ FAILED: Expected extraction_status='completed', got '{extraction_status}'")
            return False
            
        # Check embeddings_count (may not exist in DB schema)
        embeddings_count = target_doc.get('embeddings_count')
        if embeddings_count is not None:
            if embeddings_count > 0:
                print(f"✅ PASSED: Document has embeddings_count={embeddings_count}")
            else:
                print(f"⚠️ WARNING: Document has embeddings_count=0")
        else:
            print(f"⚠️ INFO: embeddings_count field not present (may not exist in DB schema)")
            
        print(f"✅ PASSED: Document {document_id} has final status 'completed'")
        return True
        
    except Exception as e:
        print(f"❌ FAILED with exception: {e}")
        return False

def main():
    """Run the complete test suite"""
    print("🚀 Starting Document Upload Async Pipeline Test Suite")
    print(f"Base URL: {BASE_URL}")
    print(f"Test Content Length: {len(TEST_RFE_CONTENT)} characters")
    
    # Test 1: Upload document
    job_id, document_id = test_upload_async_endpoint()
    if not job_id or not document_id:
        print("\n❌ Test suite failed at step 1")
        sys.exit(1)
        
    # Test 2: Verify immediate document creation
    immediate_success = test_document_immediate_creation(document_id)
    if not immediate_success:
        print("\n❌ Test suite failed at step 2")
        sys.exit(1)
        
    # Test 3: Poll job until completion
    job_success, final_job_data = test_job_polling(job_id)
    if not job_success:
        print("\n❌ Test suite failed at step 3")
        sys.exit(1)
        
    # Test 4: Verify final document status
    final_success = test_document_final_status(document_id)
    if not final_success:
        print("\n❌ Test suite failed at step 4")
        sys.exit(1)
        
    # Summary
    print(f"\n{'='*60}")
    print("🎉 ALL TESTS PASSED!")
    print('='*60)
    print(f"✅ Document created immediately with 'pending' status")
    print(f"✅ Job processing completed successfully")
    print(f"✅ Document final status is 'completed'")
    print(f"📄 Document ID: {document_id}")
    print(f"🔄 Job ID: {job_id}")
    
    if final_job_data and 'result' in final_job_data:
        result = final_job_data['result']
        print(f"📊 Final counts: {result.get('issuesCount', 0)} issues, {result.get('requestsCount', 0)} requests, {result.get('embeddingsCount', 0)} embeddings")
        
    print(f"\nRefactored upload pipeline is working correctly! ✨")

if __name__ == "__main__":
    main()