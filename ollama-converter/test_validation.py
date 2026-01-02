"""
Test script to validate the Ollama converter with incomplete data
This simulates: Investment team sends incomplete data → Ollama identifies what's missing
"""

import requests
import json

API_URL = "http://localhost:8000"

def test_incomplete_startup_data():
    """Test with incomplete startup data"""
    print("=" * 60)
    print("TEST 1: Incomplete Startup Data")
    print("=" * 60)
    
    # Simulate incomplete data from investment team
    incomplete_data = """
    Company: TechFlow AI
    Industry: AI/ML
    Funding: $2M
    Note: Missing geo markets and funding stage
    """
    
    print("\n📥 Input (incomplete data):")
    print(incomplete_data)
    
    response = requests.post(
        f"{API_URL}/convert",
        json={
            "data": incomplete_data,
            "dataType": "startup"
        }
    )
    
    result = response.json()
    
    print("\n📤 Output:")
    print(json.dumps(result, indent=2))
    
    if result.get("startups"):
        startup = result["startups"][0]
        print("\n✅ Extracted Data:")
        print(f"  Company: {startup.get('companyName', 'MISSING')}")
        print(f"  Industry: {startup.get('industry', 'MISSING')}")
        print(f"  Funding Target: ${startup.get('fundingTarget', 0):,}")
        print(f"  Geo Markets: {startup.get('geoMarkets', []) or 'MISSING'}")
        print(f"  Funding Stage: {startup.get('fundingStage', '') or 'MISSING'}")
        
        print("\n⚠️  Missing/Incomplete Fields:")
        missing = []
        if not startup.get('geoMarkets'):
            missing.append("Geo Markets")
        if not startup.get('fundingStage'):
            missing.append("Funding Stage")
        if not startup.get('companyName'):
            missing.append("Company Name")
        if not startup.get('industry'):
            missing.append("Industry")
        if not startup.get('fundingTarget'):
            missing.append("Funding Target")
        
        if missing:
            print(f"  ❌ {', '.join(missing)}")
        else:
            print("  ✅ All fields present!")
    
    print("\n" + "=" * 60 + "\n")

def test_incomplete_investor_data():
    """Test with incomplete investor data"""
    print("=" * 60)
    print("TEST 2: Incomplete Investor Data")
    print("=" * 60)
    
    incomplete_data = """
    Firm: VC Partners
    Focus: North America
    Industries: AI/ML, SaaS
    Note: Missing ticket sizes and stage preferences
    """
    
    print("\n📥 Input (incomplete data):")
    print(incomplete_data)
    
    response = requests.post(
        f"{API_URL}/convert",
        json={
            "data": incomplete_data,
            "dataType": "investor"
        }
    )
    
    result = response.json()
    
    print("\n📤 Output:")
    print(json.dumps(result, indent=2))
    
    if result.get("investors"):
        investor = result["investors"][0]
        print("\n✅ Extracted Data:")
        print(f"  Firm: {investor.get('firmName', 'MISSING')}")
        print(f"  Geo Focus: {investor.get('geoFocus', []) or 'MISSING'}")
        print(f"  Industries: {investor.get('industryPreferences', []) or 'MISSING'}")
        print(f"  Stages: {investor.get('stagePreferences', []) or 'MISSING'}")
        print(f"  Min Ticket: ${investor.get('minTicketSize', 0):,}" if investor.get('minTicketSize') else "  Min Ticket: MISSING")
        print(f"  Max Ticket: ${investor.get('maxTicketSize', 0):,}" if investor.get('maxTicketSize') else "  Max Ticket: MISSING")
        print(f"  Total Slots: {investor.get('totalSlots', 'MISSING')}")
        
        print("\n⚠️  Missing/Incomplete Fields:")
        missing = []
        if not investor.get('minTicketSize'):
            missing.append("Min Ticket Size")
        if not investor.get('maxTicketSize'):
            missing.append("Max Ticket Size")
        if not investor.get('stagePreferences'):
            missing.append("Stage Preferences")
        if not investor.get('firmName'):
            missing.append("Firm Name")
        if not investor.get('geoFocus'):
            missing.append("Geo Focus")
        
        if missing:
            print(f"  ❌ {', '.join(missing)}")
        else:
            print("  ✅ All fields present!")
    
    print("\n" + "=" * 60 + "\n")

def test_messy_table_data():
    """Test with messy table data (like from Excel/CSV)"""
    print("=" * 60)
    print("TEST 3: Messy Table Data (Real-world scenario)")
    print("=" * 60)
    
    messy_data = """
    Name,Details,Notes
    TechFlow,"AI company, $2M",Need more info
    HealthVision,Healthtech startup,Missing funding details
    VC Partners,"Invests in tech",Need ticket sizes
    """
    
    print("\n📥 Input (messy CSV-like data):")
    print(messy_data)
    
    response = requests.post(
        f"{API_URL}/convert",
        json={
            "data": messy_data
            # No dataType - auto-detect
        }
    )
    
    result = response.json()
    
    print("\n📤 Output:")
    print(f"Detected Type: {result.get('detectedType')}")
    print(f"Confidence: {result.get('confidence', 0) * 100:.1f}%")
    print(f"Warnings: {len(result.get('warnings', []))}")
    print(f"Errors: {len(result.get('errors', []))}")
    
    if result.get("warnings"):
        print("\n⚠️  Warnings (what needs attention):")
        for warning in result["warnings"]:
            print(f"  - {warning}")
    
    if result.get("startups"):
        print(f"\n✅ Found {len(result['startups'])} startups")
        for i, startup in enumerate(result["startups"], 1):
            print(f"\n  Startup {i}:")
            missing = []
            if not startup.get('geoMarkets'):
                missing.append("geoMarkets")
            if not startup.get('fundingStage'):
                missing.append("fundingStage")
            if missing:
                print(f"    Missing: {', '.join(missing)}")
    
    if result.get("investors"):
        print(f"\n✅ Found {len(result['investors'])} investors")
        for i, investor in enumerate(result["investors"], 1):
            print(f"\n  Investor {i}:")
            missing = []
            if not investor.get('minTicketSize'):
                missing.append("minTicketSize")
            if not investor.get('maxTicketSize'):
                missing.append("maxTicketSize")
            if not investor.get('stagePreferences'):
                missing.append("stagePreferences")
            if missing:
                print(f"    Missing: {', '.join(missing)}")
    
    print("\n" + "=" * 60 + "\n")

def test_validation_endpoint():
    """Test the new validation endpoint"""
    print("=" * 60)
    print("TEST 4: Validation Endpoint (What's Missing?)")
    print("=" * 60)
    
    incomplete_data = """
    Company: TechFlow AI
    Industry: AI/ML
    Funding: $2M
    """
    
    print("\n📥 Input:")
    print(incomplete_data)
    
    response = requests.post(
        f"{API_URL}/validate",
        json={
            "data": incomplete_data,
            "dataType": "startup"
        }
    )
    
    if response.status_code == 200:
        result = response.json()
        print("\n📊 Validation Report:")
        print(json.dumps(result, indent=2))
    else:
        print(f"\n❌ Error: {response.status_code}")
        print(response.text)
    
    print("\n" + "=" * 60 + "\n")

if __name__ == "__main__":
    print("\n🧪 Testing Ollama Data Converter & Validation\n")
    print("Make sure the API is running: python main.py\n")
    
    try:
        # Check if API is running
        health = requests.get(f"{API_URL}/health", timeout=2)
        print("✅ API is running!\n")
    except:
        print("❌ API is not running! Start it with: python main.py\n")
        exit(1)
    
    # Run tests
    test_incomplete_startup_data()
    test_incomplete_investor_data()
    test_messy_table_data()
    
    # Test validation endpoint if it exists
    try:
        test_validation_endpoint()
    except:
        print("⚠️  Validation endpoint not available yet (will be added)\n")
    
    print("✅ All tests completed!\n")

