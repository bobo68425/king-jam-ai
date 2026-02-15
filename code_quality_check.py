#!/usr/bin/env python3
"""
King Jam AI - 程式碼品質分析工具
用途: 掃描程式碼中的常見問題並生成報告
"""

import os
import re
from pathlib import Path
from collections import defaultdict
from typing import List, Dict, Tuple

# 顏色定義
class Colors:
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    MAGENTA = '\033[0;35m'
    CYAN = '\033[0;36m'
    NC = '\033[0m'

class CodeQualityAnalyzer:
    def __init__(self, project_root: str):
        self.project_root = Path(project_root)
        self.backend_dir = self.project_root / "backend"
        self.frontend_dir = self.project_root / "frontend"
        
        self.issues = defaultdict(list)
        
    def analyze(self):
        """執行完整的程式碼品質分析"""
        print(f"{Colors.BLUE}{'='*60}{Colors.NC}")
        print(f"{Colors.BLUE}  🔍 King Jam AI 程式碼品質分析{Colors.NC}")
        print(f"{Colors.BLUE}{'='*60}{Colors.NC}\n")
        
        # 後端分析
        print(f"{Colors.CYAN}[1/5] 分析後端程式碼...{Colors.NC}")
        self.analyze_backend()
        
        # 前端分析
        print(f"{Colors.CYAN}[2/5] 分析前端程式碼...{Colors.NC}")
        self.analyze_frontend()
        
        # 安全性檢查
        print(f"{Colors.CYAN}[3/5] 安全性檢查...{Colors.NC}")
        self.check_security()
        
        # 效能檢查
        print(f"{Colors.CYAN}[4/5] 效能檢查...{Colors.NC}")
        self.check_performance()
        
        # 文件檢查
        print(f"{Colors.CYAN}[5/5] 文件完整性檢查...{Colors.NC}")
        self.check_documentation()
        
        # 生成報告
        self.generate_report()
    
    def analyze_backend(self):
        """分析後端 Python 程式碼"""
        if not self.backend_dir.exists():
            print(f"{Colors.RED}  ❌ 後端目錄不存在{Colors.NC}")
            return
        
        py_files = list(self.backend_dir.rglob("*.py"))
        print(f"{Colors.GREEN}  ✅ 找到 {len(py_files)} 個 Python 檔案{Colors.NC}")
        
        for py_file in py_files:
            self._analyze_python_file(py_file)
    
    def _analyze_python_file(self, file_path: Path):
        """分析單個 Python 檔案"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                lines = content.split('\n')
            
            rel_path = file_path.relative_to(self.project_root)
            
            # 1. 檢查裸露的 except
            bare_except_pattern = re.compile(r'^\s*except\s*:\s*$')
            for i, line in enumerate(lines, 1):
                if bare_except_pattern.match(line):
                    self.issues['bare_except'].append({
                        'file': str(rel_path),
                        'line': i,
                        'content': line.strip()
                    })
            
            # 2. 檢查通用 Exception
            raise_exception_pattern = re.compile(r'raise\s+Exception\s*\(')
            for i, line in enumerate(lines, 1):
                if raise_exception_pattern.search(line):
                    self.issues['generic_exception'].append({
                        'file': str(rel_path),
                        'line': i,
                        'content': line.strip()
                    })
            
            # 3. 檢查 TODO/FIXME
            todo_pattern = re.compile(r'#\s*(TODO|FIXME|XXX|HACK)', re.IGNORECASE)
            for i, line in enumerate(lines, 1):
                match = todo_pattern.search(line)
                if match:
                    self.issues['todo'].append({
                        'file': str(rel_path),
                        'line': i,
                        'type': match.group(1).upper(),
                        'content': line.strip()
                    })
            
            # 4. 檢查 print() 語句 (應使用 logger)
            print_pattern = re.compile(r'^\s*print\s*\(')
            for i, line in enumerate(lines, 1):
                if print_pattern.match(line) and 'logger' not in content[:content.find(line)]:
                    self.issues['print_statement'].append({
                        'file': str(rel_path),
                        'line': i,
                        'content': line.strip()
                    })
            
            # 5. 檢查長函數 (>100 行)
            func_pattern = re.compile(r'^(async\s+)?def\s+(\w+)\s*\(')
            current_func = None
            func_start = 0
            indent_level = 0
            
            for i, line in enumerate(lines, 1):
                match = func_pattern.match(line)
                if match:
                    if current_func and (i - func_start) > 100:
                        self.issues['long_function'].append({
                            'file': str(rel_path),
                            'line': func_start,
                            'function': current_func,
                            'length': i - func_start
                        })
                    current_func = match.group(2)
                    func_start = i
                    indent_level = len(line) - len(line.lstrip())
            
        except Exception as e:
            print(f"{Colors.RED}  ⚠️  無法分析 {file_path}: {e}{Colors.NC}")
    
    def analyze_frontend(self):
        """分析前端 TypeScript/JavaScript 程式碼"""
        if not self.frontend_dir.exists():
            print(f"{Colors.RED}  ❌ 前端目錄不存在{Colors.NC}")
            return
        
        ts_files = list(self.frontend_dir.rglob("*.ts")) + \
                   list(self.frontend_dir.rglob("*.tsx")) + \
                   list(self.frontend_dir.rglob("*.js")) + \
                   list(self.frontend_dir.rglob("*.jsx"))
        
        # 排除 node_modules
        ts_files = [f for f in ts_files if 'node_modules' not in str(f)]
        
        print(f"{Colors.GREEN}  ✅ 找到 {len(ts_files)} 個前端檔案{Colors.NC}")
        
        for ts_file in ts_files:
            self._analyze_typescript_file(ts_file)
    
    def _analyze_typescript_file(self, file_path: Path):
        """分析單個 TypeScript/JavaScript 檔案"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                lines = content.split('\n')
            
            rel_path = file_path.relative_to(self.project_root)
            
            # 1. 檢查 TODO/FIXME
            todo_pattern = re.compile(r'/[/*]\s*(TODO|FIXME|XXX|HACK)', re.IGNORECASE)
            for i, line in enumerate(lines, 1):
                match = todo_pattern.search(line)
                if match:
                    self.issues['todo'].append({
                        'file': str(rel_path),
                        'line': i,
                        'type': match.group(1).upper(),
                        'content': line.strip()
                    })
            
            # 2. 檢查 console.log (生產環境應移除)
            console_pattern = re.compile(r'console\.(log|debug|info)')
            for i, line in enumerate(lines, 1):
                if console_pattern.search(line):
                    self.issues['console_log'].append({
                        'file': str(rel_path),
                        'line': i,
                        'content': line.strip()
                    })
            
            # 3. 檢查 any 類型
            any_pattern = re.compile(r':\s*any\b')
            for i, line in enumerate(lines, 1):
                if any_pattern.search(line):
                    self.issues['any_type'].append({
                        'file': str(rel_path),
                        'line': i,
                        'content': line.strip()
                    })
            
        except Exception as e:
            print(f"{Colors.RED}  ⚠️  無法分析 {file_path}: {e}{Colors.NC}")
    
    def check_security(self):
        """安全性檢查"""
        # 檢查 .env 是否在 .gitignore 中
        gitignore_path = self.project_root / ".gitignore"
        if gitignore_path.exists():
            with open(gitignore_path, 'r') as f:
                gitignore_content = f.read()
                if '.env' in gitignore_content:
                    print(f"{Colors.GREEN}  ✅ .env 已加入 .gitignore{Colors.NC}")
                else:
                    self.issues['security'].append({
                        'type': 'gitignore',
                        'message': '.env 未加入 .gitignore'
                    })
        
        # 檢查是否有硬編碼的密鑰
        sensitive_patterns = [
            (r'password\s*=\s*["\'](?!.*\$\{)[^"\']+["\']', 'hardcoded_password'),
            (r'api[_-]?key\s*=\s*["\'](?!.*\$\{)[^"\']+["\']', 'hardcoded_api_key'),
            (r'secret\s*=\s*["\'](?!.*\$\{)[^"\']+["\']', 'hardcoded_secret'),
        ]
        
        for py_file in self.backend_dir.rglob("*.py"):
            try:
                with open(py_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                    for pattern, issue_type in sensitive_patterns:
                        if re.search(pattern, content, re.IGNORECASE):
                            self.issues['security'].append({
                                'type': issue_type,
                                'file': str(py_file.relative_to(self.project_root)),
                                'message': f'可能的硬編碼敏感資訊: {issue_type}'
                            })
            except:
                pass
    
    def check_performance(self):
        """效能檢查"""
        # 檢查是否有 N+1 查詢問題的跡象
        n_plus_one_pattern = re.compile(r'for\s+\w+\s+in\s+.*:\s*\n\s+.*\.query\(')
        
        for py_file in self.backend_dir.rglob("*.py"):
            try:
                with open(py_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                    if n_plus_one_pattern.search(content):
                        self.issues['performance'].append({
                            'type': 'potential_n_plus_one',
                            'file': str(py_file.relative_to(self.project_root)),
                            'message': '可能的 N+1 查詢問題'
                        })
            except:
                pass
        
        print(f"{Colors.GREEN}  ✅ 效能檢查完成{Colors.NC}")
    
    def check_documentation(self):
        """文件完整性檢查"""
        required_docs = [
            'README.md',
            'SETUP.md',
            '.env.example',
        ]
        
        for doc in required_docs:
            doc_path = self.project_root / doc
            if doc_path.exists():
                print(f"{Colors.GREEN}  ✅ {doc} 存在{Colors.NC}")
            else:
                self.issues['documentation'].append({
                    'file': doc,
                    'message': f'缺少 {doc}'
                })
    
    def generate_report(self):
        """生成分析報告"""
        print(f"\n{Colors.BLUE}{'='*60}{Colors.NC}")
        print(f"{Colors.BLUE}  📊 分析報告{Colors.NC}")
        print(f"{Colors.BLUE}{'='*60}{Colors.NC}\n")
        
        total_issues = sum(len(v) for v in self.issues.values())
        
        if total_issues == 0:
            print(f"{Colors.GREEN}🎉 恭喜!未發現任何問題。{Colors.NC}\n")
            return
        
        # 裸露的 except
        if self.issues['bare_except']:
            print(f"{Colors.YELLOW}⚠️  裸露的 Exception 處理: {len(self.issues['bare_except'])} 個{Colors.NC}")
            for issue in self.issues['bare_except'][:5]:
                print(f"   {issue['file']}:{issue['line']}")
            if len(self.issues['bare_except']) > 5:
                print(f"   ... 還有 {len(self.issues['bare_except']) - 5} 個")
            print()
        
        # 通用 Exception
        if self.issues['generic_exception']:
            print(f"{Colors.YELLOW}⚠️  通用 Exception 拋出: {len(self.issues['generic_exception'])} 個{Colors.NC}")
            for issue in self.issues['generic_exception'][:5]:
                print(f"   {issue['file']}:{issue['line']}")
            if len(self.issues['generic_exception']) > 5:
                print(f"   ... 還有 {len(self.issues['generic_exception']) - 5} 個")
            print()
        
        # TODO/FIXME
        if self.issues['todo']:
            print(f"{Colors.CYAN}ℹ️  待辦事項 (TODO/FIXME): {len(self.issues['todo'])} 個{Colors.NC}")
            todo_by_type = defaultdict(int)
            for issue in self.issues['todo']:
                todo_by_type[issue['type']] += 1
            for todo_type, count in todo_by_type.items():
                print(f"   {todo_type}: {count} 個")
            print()
        
        # console.log
        if self.issues['console_log']:
            print(f"{Colors.YELLOW}⚠️  console.log 語句: {len(self.issues['console_log'])} 個{Colors.NC}")
            print(f"   建議在生產環境移除或使用適當的日誌工具")
            print()
        
        # any 類型
        if self.issues['any_type']:
            print(f"{Colors.YELLOW}⚠️  使用 any 類型: {len(self.issues['any_type'])} 個{Colors.NC}")
            print(f"   建議使用更具體的類型定義")
            print()
        
        # 安全性問題
        if self.issues['security']:
            print(f"{Colors.RED}🔒 安全性問題: {len(self.issues['security'])} 個{Colors.NC}")
            for issue in self.issues['security']:
                print(f"   {issue.get('file', 'N/A')}: {issue['message']}")
            print()
        
        # 長函數
        if self.issues['long_function']:
            print(f"{Colors.YELLOW}⚠️  過長的函數: {len(self.issues['long_function'])} 個{Colors.NC}")
            for issue in self.issues['long_function'][:5]:
                print(f"   {issue['file']}:{issue['line']} - {issue['function']}() ({issue['length']} 行)")
            if len(self.issues['long_function']) > 5:
                print(f"   ... 還有 {len(self.issues['long_function']) - 5} 個")
            print()
        
        # 總結
        print(f"{Colors.BLUE}{'='*60}{Colors.NC}")
        print(f"{Colors.YELLOW}總計發現 {total_issues} 個問題{Colors.NC}")
        print(f"{Colors.BLUE}{'='*60}{Colors.NC}\n")
        
        # 建議
        print(f"{Colors.CYAN}💡 改進建議:{Colors.NC}")
        print(f"  1. 將裸露的 except: 改為 except Exception as e:")
        print(f"  2. 創建自定義異常類別取代通用 Exception")
        print(f"  3. 建立 GitHub Issues 追蹤 TODO 項目")
        print(f"  4. 移除或替換 console.log 為適當的日誌工具")
        print(f"  5. 為 TypeScript 的 any 類型提供更具體的類型定義")
        print()

if __name__ == "__main__":
    import sys
    
    # 獲取專案根目錄
    if len(sys.argv) > 1:
        project_root = sys.argv[1]
    else:
        project_root = os.path.dirname(os.path.abspath(__file__))
    
    analyzer = CodeQualityAnalyzer(project_root)
    analyzer.analyze()
