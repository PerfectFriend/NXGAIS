#!/usr/bin/env python3
import os
import zipfile
import hashlib

TARGETS = [
    './nexxus-v2.0-source-and-audit.zip',
    'public/nexxus-v2.0-source-and-audit.zip'
]

DIRECTORIES = [
    'src',
    'scripts',
    'test',
    'contracts',
    'nexxus-vectors',
    'assets'
]

EXPLICIT_FILES = [
    'KURILKA.md',
    'Kurilka.md',
    'PISMO_KLAUDU_EDINOE_YADRO.md',
    'ACCEPTANCE_NEXXUS_CORE_TZ.md',
    'PROTOCOL_WIRE_SPEC.md',
    'OTVET_KLAUDU.md',
    'Переписка-С-Клодом.md',
    'Perepiska-S-Claudom.md',
    'MANIFESTO.md',
    'NexxusHowTo.MD',
    'NexxusManual.MD',
    'ПерепискаТроцкогоСКауцким.MD',
    'README.md',
    'package.json',
    'tsconfig.json',
    'vite.config.ts',
    'metadata.json',
    '.env.example',
    '.gitignore',
    'index.html',
    'public/packages/nexxus-node_latest_amd64.deb'
]

def collect_files():
    all_files = []
    for d in DIRECTORIES:
        if os.path.isdir(d):
            for root, dirs, files in os.walk(d):
                for f in files:
                    if f.endswith('.zip') or '__pycache__' in root:
                        continue
                    full_path = os.path.join(root, f)
                    all_files.append((full_path, full_path.lstrip('./')))
    
    for f in EXPLICIT_FILES:
        if os.path.isfile(f):
            all_files.append((f, f.lstrip('./')))
            
    # Deduplicate by archive name
    seen = set()
    deduped = []
    for disk_path, arc_name in all_files:
        if arc_name not in seen:
            seen.add(arc_name)
            deduped.append((disk_path, arc_name))
    return deduped

def main():
    files_to_pack = collect_files()
    print(f"📦 Packing {len(files_to_pack)} files into NeXXUs v2.0 Source & Audit Zip...")
    
    for target in TARGETS:
        os.makedirs(os.path.dirname(os.path.abspath(target)), exist_ok=True)
        if os.path.exists(target):
            os.remove(target)
            
        with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
            for disk_path, arc_name in files_to_pack:
                z.write(disk_path, arc_name)
                
        # Compute SHA-256 and size
        with open(target, 'rb') as f:
            data = f.read()
            sha256 = hashlib.sha256(data).hexdigest()
            size_kb = len(data) / 1024.0
            
        print(f"✅ Created {target}:")
        print(f"   Size: {size_kb:.1f} KB ({len(data)} bytes)")
        print(f"   SHA-256: {sha256}")

if __name__ == '__main__':
    main()
