#!/usr/bin/env python3
"""
Backend Test for Document Upload Async Pipeline 
Tests the full async upload pipeline focusing on Bug 3 fix:
- Upload realistic RFE content
- Poll until completion 
- Verify issues and requests are properly saved to DB
- Check server logs for error handling
"""

import os
import time
import requests
import json
from io import StringIO

# Get base URL from environment
BASE_URL = "https://cerebro-visas-2.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

def log_test_result(test_name, success, details=""):
    """Log test results with clear formatting"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} {test_name}")
    if details:
        print(f"   {details}")
    print()

def create_test_rfe_content():
    """Create realistic RFE content for EB-2 NIW testing"""
    return """U.S. Citizenship and Immigration Services
REQUEST FOR EVIDENCE

RE: Form I-140, Immigrant Petition for Alien Workers
Receipt Number: IOE-0912345678
Beneficiary: Dr. Jane Smith
Priority Date: February 15, 2024

This office is unable to approve this petition for the following reasons.

The petitioner seeks classification as a member of the professions holding an advanced degree with a National Interest Waiver under section 203(b)(2) of the Immigration and Nationality Act.

Under the Dhanasar framework established in Matter of Dhanasar, 26 I&N Dec. 884 (AAO 2016), the petitioner must demonstrate three prongs:

PRONG 1: The proposed endeavor has both substantial merit and national importance.

The petitioner claims to work in artificial intelligence and machine learning for medical diagnosis. However, the evidence submitted does not sufficiently demonstrate that the proposed endeavor has national importance beyond the petitioner's immediate field of work. While the field of AI in healthcare is generally important, the petitioner has not provided sufficient evidence showing how the specific proposed endeavor would have broad implications for the United States healthcare system or economy.

The petitioner submitted research papers and conference presentations, but these do not clearly establish that the proposed work rises to the level of national importance required under Dhanasar. The beneficiary must demonstrate that the proposed endeavor has the potential to employ U.S. workers or has other economic effects of national or multi-regional scope.

PRONG 2: The petitioner is well positioned to advance the proposed endeavor.

While the petitioner has a doctoral degree in Computer Science from Stanford University and has published 15 peer-reviewed articles, the evidence does not establish that the petitioner's qualifications and achievements are commensurate with the scope of the proposed endeavor. The recommendation letters are general in nature and do not specifically address the petitioner's unique contributions to the field.

The letters of recommendation fail to provide specific examples of how the beneficiary's past achievements position them to advance the proposed endeavor. Additionally, the petitioner has not provided evidence of prior success in implementing AI solutions in clinical settings.

PRONG 3: On balance, it would be beneficial to the United States to waive the requirements of a job offer and thus of a labor certification.

The record does not contain sufficient evidence to demonstrate that the benefit of waiving the job offer requirement outweighs the national interest inherent in the labor certification process. The petitioner must show that the national interest would be adversely affected if a labor certification were required.

The evidence shows that there are other qualified U.S. workers in the field of machine learning and AI. The petitioner has not demonstrated why it would be contrary to the national interest to protect the job opportunities of U.S. workers through the labor certification process.

ADDITIONAL ISSUES:

1. The petitioner's business plan lacks concrete implementation timelines and measurable outcomes.
2. Evidence of funding sources for the proposed research is insufficient.
3. The impact letters do not demonstrate how the beneficiary's work differs significantly from ongoing research by other professionals in the field.

REQUESTS FOR EVIDENCE:

Please submit the following evidence within 87 days from the date of this notice:

1. Detailed documentation showing how the proposed endeavor has national importance beyond the immediate field, including economic impact studies or government reports highlighting the national need for this specific type of research.

2. Evidence of the beneficiary's unique qualifications, including:
   - Detailed letters from independent experts explaining how the beneficiary's specific contributions advance the field
   - Evidence of successful implementation of AI solutions in clinical or commercial settings
   - Documentation of any patents, commercialized technologies, or products developed by the beneficiary

3. Documentation establishing that waiving the labor certification requirement would benefit the United States:
   - Evidence that the beneficiary's proposed work cannot be performed by available U.S. workers
   - Economic impact analysis showing the national benefits of the proposed endeavor
   - Letters from government agencies or major institutions supporting the national importance of the work

4. A comprehensive business plan with:
   - Specific timelines for project implementation
   - Measurable outcomes and success metrics
   - Evidence of secured funding or institutional support

5. Independent expert testimony addressing:
   - The uniqueness of the beneficiary's approach compared to existing research
   - The potential national and international impact of the proposed work
   - Why the beneficiary is uniquely qualified to carry out this endeavor

Failure to submit the requested evidence may result in denial of this petition.

Sincerely,

Immigration Services Officer
Texas Service Center
U.S. Citizenship and Immigration Services"""

def test_upload_async_post():
    """Test POST /api/documents/upload-async endpoint"""
    try:
        # Create test file content
        rfe_content = create_test_rfe_content()
        
        # Prepare multipart form data
        files = {
            'file': ('test_rfe_document.txt', rfe_content, 'text/plain')
        }
        data = {
            'docType': 'RFE',
            'processWithAI': 'true'
        }
        
        print("📤 Testing document upload...")
        print(f"   Document size: {len(rfe_content)} characters")
        print(f"   Contains NIW content: {'Dhanasar' in rfe_content}")
        print(f"   Contains prong references: {'PRONG 1' in rfe_content}")
        
        response = requests.post(f"{API_BASE}/documents/upload-async", files=files, data=data)
        
        if response.status_code != 200:
            log_test_result("Upload POST", False, f"Status: {response.status_code}, Response: {response.text}")
            return None
        
        result = response.json()
        
        if not result.get('success') or not result.get('jobId'):
            log_test_result("Upload POST", False, f"Invalid response: {result}")
            return None
        
        job_id = result['jobId']
        log_test_result("Upload POST", True, f"JobId: {job_id}")
        return job_id
        
    except Exception as e:
        log_test_result("Upload POST", False, f"Exception: {str(e)}")
        return None

def test_upload_async_polling(job_id):
    """Test GET /api/documents/upload-async polling until completion"""
    if not job_id:
        log_test_result("Upload Polling", False, "No jobId provided")
        return None
    
    try:
        print(f"🔄 Polling job status for {job_id}...")
        max_attempts = 30  # 30 attempts, 10 seconds each = 5 minutes max
        attempt = 0
        
        while attempt < max_attempts:
            attempt += 1
            response = requests.get(f"{API_BASE}/documents/upload-async?jobId={job_id}")
            
            if response.status_code != 200:
                log_test_result("Upload Polling", False, f"Status: {response.status_code}")
                return None
            
            job_data = response.json()
            status = job_data.get('status', 'unknown')
            progress = job_data.get('progress', 0)
            
            print(f"   Attempt {attempt}: Status={status}, Progress={progress}%")
            
            if status == 'completed':
                result_data = job_data.get('result', {})
                issues_count = result_data.get('issuesCount', 0)
                requests_count = result_data.get('requestsCount', 0)
                
                print(f"   ✅ Job completed!")
                print(f"   Issues found: {issues_count}")
                print(f"   Requests found: {requests_count}")
                
                # Critical check: Both counts should be > 0 for RFE content
                if issues_count > 0 and requests_count > 0:
                    log_test_result("Upload Polling - Data Extraction", True, 
                                  f"Issues: {issues_count}, Requests: {requests_count}")
                else:
                    log_test_result("Upload Polling - Data Extraction", False, 
                                  f"Missing data - Issues: {issues_count}, Requests: {requests_count}")
                
                return job_data
            
            elif status == 'failed':
                error_msg = job_data.get('error', 'Unknown error')
                log_test_result("Upload Polling", False, f"Job failed: {error_msg}")
                return None
            
            elif status in ['uploading', 'uploaded', 'extracting', 'extracted', 'saving', 'saving_db', 'analyzing', 'embeddings']:
                # Job still in progress, wait and continue
                time.sleep(10)
            else:
                log_test_result("Upload Polling", False, f"Unknown status: {status}")
                return None
        
        log_test_result("Upload Polling", False, "Timeout waiting for job completion")
        return None
        
    except Exception as e:
        log_test_result("Upload Polling", False, f"Exception: {str(e)}")
        return None

def test_server_logs():
    """Check server logs for DB save success messages"""
    try:
        print("📋 Checking server logs for DB save messages...")
        
        # Get recent logs from supervisor
        import subprocess
        result = subprocess.run(['tail', '-n', '50', '/var/log/supervisor/nextjs.out.log'], 
                              capture_output=True, text=True)
        
        if result.returncode != 0:
            log_test_result("Server Logs Check", False, "Could not read log file")
            return False
        
        log_content = result.stdout
        print("   Recent log entries:")
        
        # Look for key messages
        issues_saved = "Issues guardados:" in log_content or "Issues guardados individualmente:" in log_content
        requests_saved = "Requests guardados:" in log_content or "Requests guardados individualmente:" in log_content
        error_messages = "⚠️ Error" in log_content
        openrouter_used = "Using OpenRouter for extraction" in log_content or "Usando OpenRouter" in log_content
        
        # Print relevant log lines
        for line in log_content.split('\n')[-20:]:  # Last 20 lines
            if any(keyword in line for keyword in ["Issues guardados", "Requests guardados", "OpenRouter", "⚠️", "✅", "📤"]):
                print(f"     {line}")
        
        success = issues_saved and requests_saved and not error_messages
        details = []
        if issues_saved:
            details.append("Issues save confirmed")
        if requests_saved:
            details.append("Requests save confirmed")
        if openrouter_used:
            details.append("OpenRouter API used")
        if error_messages:
            details.append("⚠️ Errors found in logs")
        
        log_test_result("Server Logs Check", success, ", ".join(details))
        return success
        
    except Exception as e:
        log_test_result("Server Logs Check", False, f"Exception: {str(e)}")
        return False

def test_structured_data_content(job_result):
    """Verify the structured data contains expected content"""
    if not job_result:
        log_test_result("Structured Data Content", False, "No job result provided")
        return False
    
    try:
        result_data = job_result.get('result', {})
        document_id = result_data.get('documentId')
        
        if not document_id:
            log_test_result("Structured Data Content", False, "No document ID in result")
            return False
        
        print(f"📊 Analyzing structured data content...")
        print(f"   Document ID: {document_id}")
        
        # Check the content was properly extracted
        text_length = result_data.get('textLength', 0)
        issues_count = result_data.get('issuesCount', 0)
        requests_count = result_data.get('requestsCount', 0)
        
        print(f"   Text extracted: {text_length} characters")
        print(f"   Issues extracted: {issues_count}")
        print(f"   Requests extracted: {requests_count}")
        
        # For the RFE content we provided, we expect:
        # - At least 3-5 issues (Prong 1, Prong 2, Prong 3 deficiencies)
        # - At least 3-5 requests (evidence requests for each prong)
        success = (text_length > 1000 and 
                  issues_count >= 3 and 
                  requests_count >= 3)
        
        if success:
            log_test_result("Structured Data Content", True, 
                          f"Valid extraction - {issues_count} issues, {requests_count} requests")
        else:
            log_test_result("Structured Data Content", False, 
                          f"Insufficient data - Text: {text_length}, Issues: {issues_count}, Requests: {requests_count}")
        
        return success
        
    except Exception as e:
        log_test_result("Structured Data Content", False, f"Exception: {str(e)}")
        return False

def main():
    """Run all backend tests for document upload async pipeline"""
    print("=" * 80)
    print("🧪 BACKEND TESTING: Document Upload Async Pipeline")
    print("   Focus: Bug 3 fix - saveStructuredData DB error handling")
    print("=" * 80)
    print()
    
    # Test sequence
    job_id = test_upload_async_post()
    
    if job_id:
        job_result = test_upload_async_polling(job_id)
        
        if job_result:
            test_structured_data_content(job_result)
        
        # Check server logs regardless of job completion
        test_server_logs()
    
    print("=" * 80)
    print("🏁 BACKEND TESTING COMPLETE")
    print("=" * 80)

if __name__ == "__main__":
    main()