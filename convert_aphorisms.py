#!/usr/bin/env python3
"""
Convert aphorisms from entries.txt to individual markdown files.
Each aphorism gets its own numbered markdown file with frontmatter.
"""

def main():
    # Read the entries.txt file
    with open('aphorism/entries.txt', 'r') as f:
        content = f.read()
    
    # Split by double newlines to get individual aphorisms
    aphorisms = content.strip().split('\n\n')
    
    # Create markdown file for each aphorism
    for i, aphorism in enumerate(aphorisms, 1):
        # Remove any trailing/leading whitespace from the aphorism
        aphorism_content = aphorism.strip()
        
        # Create frontmatter
        frontmatter = f"""---
title: "#{i}"
date: 2025-09-06
draft: false
description: ""
author: Justin Fuller
slug: {i}
tags: [aphorism]
weight: 1
---"""
        
        # Combine frontmatter and content
        markdown_content = f"{frontmatter}\n\n{aphorism_content}\n"
        
        # Write to file
        filename = f'aphorism/{i}.md'
        with open(filename, 'w') as f:
            f.write(markdown_content)
        
        print(f"Created {filename}")
    
    print(f"\nSuccessfully created {len(aphorisms)} markdown files")
    print("Original entries.txt preserved")

if __name__ == "__main__":
    main()