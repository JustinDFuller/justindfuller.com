#!/usr/bin/env python3
"""
Validate that all aphorisms were correctly converted from entries.txt to markdown files.
"""

def main():
    # Read the original entries.txt file
    with open('aphorism/entries.txt', 'r') as f:
        original_content = f.read()
    
    # Split by double newlines to get individual aphorisms
    original_aphorisms = original_content.strip().split('\n\n')
    
    # Read each markdown file and extract the content
    all_valid = True
    for i, original_aphorism in enumerate(original_aphorisms, 1):
        filename = f'aphorism/{i}.md'
        
        try:
            with open(filename, 'r') as f:
                md_content = f.read()
            
            # Extract content after the frontmatter
            parts = md_content.split('---')
            if len(parts) >= 3:
                # Content is after the second '---'
                actual_content = '---'.join(parts[2:]).strip()
            else:
                print(f"ERROR: {filename} - Invalid frontmatter format")
                all_valid = False
                continue
            
            # Compare content
            original_clean = original_aphorism.strip()
            actual_clean = actual_content.strip()
            
            if original_clean != actual_clean:
                print(f"ERROR: {filename} - Content mismatch")
                print(f"  Original: {original_clean[:50]}...")
                print(f"  Actual:   {actual_clean[:50]}...")
                all_valid = False
            else:
                print(f"✓ {filename} - Content matches")
                
        except FileNotFoundError:
            print(f"ERROR: {filename} - File not found")
            all_valid = False
    
    # Summary
    print(f"\n{'='*50}")
    if all_valid:
        print(f"✅ SUCCESS: All {len(original_aphorisms)} aphorisms validated successfully!")
        print("Original entries.txt preserved and unchanged.")
    else:
        print("❌ ERRORS FOUND: Some aphorisms were not converted correctly")
        
    return all_valid

if __name__ == "__main__":
    import sys
    success = main()
    sys.exit(0 if success else 1)