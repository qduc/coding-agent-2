#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface ErrorReport {
  missingFiles: string[];
  missingComponents: string[];
  typeErrors: string[];
  importExportIssues: string[];
  configIssues: string[];
}

class CodebaseChecker {
  private srcDir = path.join(process.cwd(), 'src');
  private errors: ErrorReport = {
    missingFiles: [],
    missingComponents: [],
    typeErrors: [],
    importExportIssues: [],
    configIssues: []
  };

  async checkCodebase(): Promise<void> {
    console.log('🔍 Analyzing codebase structure...\n');
    
    // Check file structure
    this.checkFileStructure();
    
    // Check TypeScript compilation
    this.checkTypeScriptCompilation();
    
    // Check imports/exports
    await this.checkImportsExports();
    
    // Generate report
    this.generateReport();
  }

  private checkFileStructure(): void {
    console.log('📁 Checking file structure...');
    
    const expectedDirs = ['cli', 'core', 'tools', 'services', 'utils'];
    const actualDirs = this.getDirectories(this.srcDir);
    
    expectedDirs.forEach(dir => {
      const dirPath = path.join(this.srcDir, dir);
      if (!fs.existsSync(dirPath)) {
        this.errors.missingFiles.push(`Missing directory: src/${dir}`);
      }
    });

    // Check for unexpected directories that might be causing import issues
    const unexpectedDirs = actualDirs.filter(dir => !expectedDirs.includes(dir));
    if (unexpectedDirs.length > 0) {
      console.log(`  ⚠️  Unexpected directories: ${unexpectedDirs.join(', ')}`);
    }

    console.log(`  ✅ Found directories: ${actualDirs.join(', ')}\n`);
  }

  private checkTypeScriptCompilation(): void {
    console.log('🔧 Checking TypeScript compilation...');
    
    try {
      const output = execSync('npx tsc --noEmit --listFiles', { 
        encoding: 'utf8',
        cwd: process.cwd()
      });
      console.log('  ✅ TypeScript compilation check completed\n');
    } catch (error: any) {
      console.log('  ❌ TypeScript compilation errors found');
      
      const errorOutput = error.stdout || error.stderr || '';
      this.categorizeTypeScriptErrors(errorOutput);
      console.log('');
    }
  }

  private categorizeTypeScriptErrors(output: string): void {
    const lines = output.split('\n');
    
    lines.forEach(line => {
      if (line.includes("Cannot find module")) {
        this.errors.missingFiles.push(line.trim());
      } else if (line.includes("has no exported member") || line.includes("does not exist on type")) {
        this.errors.importExportIssues.push(line.trim());
      } else if (line.includes("implicitly has an 'any' type") || line.includes("Type") && line.includes("error")) {
        this.errors.typeErrors.push(line.trim());
      } else if (line.includes("TS") && line.includes("error")) {
        // Generic TypeScript errors
        if (line.includes("Cannot resolve configuration")) {
          this.errors.configIssues.push(line.trim());
        } else {
          this.errors.typeErrors.push(line.trim());
        }
      }
    });
  }

  private async checkImportsExports(): Promise<void> {
    console.log('📦 Checking imports and exports...');
    
    const tsFiles = this.getAllTypeScriptFiles();
    
    for (const file of tsFiles) {
      await this.analyzeFile(file);
    }
    
    console.log(`  ✅ Analyzed ${tsFiles.length} TypeScript files\n`);
  }

  private async analyzeFile(filePath: string): Promise<void> {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const imports = this.extractImports(content);
      
      for (const importInfo of imports) {
        if (importInfo.isRelative) {
          const resolvedPath = this.resolveImportPath(filePath, importInfo.path);
          if (!fs.existsSync(resolvedPath)) {
            this.errors.missingFiles.push(
              `${filePath}: Cannot find '${importInfo.path}' -> ${resolvedPath}`
            );
          }
        }
      }
    } catch (error) {
      this.errors.configIssues.push(`Error reading file: ${filePath}`);
    }
  }

  private extractImports(content: string): Array<{path: string, isRelative: boolean}> {
    const importRegex = /import.*?from\s+['"]([^'"]+)['"]/g;
    const imports: Array<{path: string, isRelative: boolean}> = [];
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      const path = match[1];
      imports.push({
        path,
        isRelative: path.startsWith('./') || path.startsWith('../')
      });
    }
    
    return imports;
  }

  private resolveImportPath(fromFile: string, importPath: string): string {
    const fromDir = path.dirname(fromFile);
    const resolved = path.resolve(fromDir, importPath);
    
    // Try different extensions
    const extensions = ['', '.ts', '.tsx', '.js', '.jsx'];
    for (const ext of extensions) {
      const withExt = resolved + ext;
      if (fs.existsSync(withExt)) {
        return withExt;
      }
    }
    
    // Try index files
    for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
      const indexFile = path.join(resolved, `index${ext}`);
      if (fs.existsSync(indexFile)) {
        return indexFile;
      }
    }
    
    return resolved;
  }

  private getAllTypeScriptFiles(): string[] {
    const files: string[] = [];
    
    const walkDir = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          walkDir(fullPath);
        } else if (item.endsWith('.ts') || item.endsWith('.tsx')) {
          files.push(fullPath);
        }
      }
    };
    
    walkDir(this.srcDir);
    return files;
  }

  private getDirectories(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    
    return fs.readdirSync(dir).filter(item => {
      const fullPath = path.join(dir, item);
      return fs.statSync(fullPath).isDirectory() && !item.startsWith('.');
    });
  }

  private generateReport(): void {
    console.log('📊 ERROR REPORT\n');
    console.log('='.repeat(50));
    
    this.printErrorSection('🚫 Missing Files/Modules', this.errors.missingFiles);
    this.printErrorSection('📦 Import/Export Issues', this.errors.importExportIssues);
    this.printErrorSection('🔧 Type Errors', this.errors.typeErrors);
    this.printErrorSection('⚙️  Configuration Issues', this.errors.configIssues);
    
    const totalErrors = Object.values(this.errors).reduce((sum, arr) => sum + arr.length, 0);
    
    console.log('\n' + '='.repeat(50));
    console.log(`📈 SUMMARY: ${totalErrors} total issues found`);
    
    if (totalErrors === 0) {
      console.log('🎉 No issues found! Your codebase looks good.');
    } else {
      console.log('\n💡 NEXT STEPS:');
      console.log('1. Create missing files/directories');
      console.log('2. Fix import/export statements');
      console.log('3. Add missing type definitions');
      console.log('4. Run this script again to verify fixes');
    }
  }

  private printErrorSection(title: string, errors: string[]): void {
    if (errors.length === 0) {
      console.log(`${title}: ✅ No issues`);
      return;
    }
    
    console.log(`${title}: ❌ ${errors.length} issues`);
    errors.slice(0, 10).forEach((error, i) => {
      console.log(`  ${i + 1}. ${error}`);
    });
    
    if (errors.length > 10) {
      console.log(`  ... and ${errors.length - 10} more`);
    }
    console.log('');
  }
}

// Main execution
async function main() {
  const checker = new CodebaseChecker();
  await checker.checkCodebase();
}

if (require.main === module) {
  main().catch(console.error);
}
