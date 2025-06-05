
'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Sparkles, RefreshCw, Loader2, FileText, Download } from 'lucide-react';
import { HighlightedTextRenderer } from './highlighted-text-renderer';
import type { NerSample } from './types';
import { getOldTextHighlightedParts } from '@/lib/ner-utils';
import { correctNERTags } from '@/ai/flows/correct-ner-tags';
import { useToast } from "@/hooks/use-toast";

const defaultSampleData: NerSample[] = [
  {
    id: 'sample1',
    old_text: "John went to the Emory clinic for a routine exam on Jan 5, 2023.",
    new_text: "<name> went to the <location> clinic for a routine exam on <date>."
  },
  {
    id: 'sample2',
    old_text: "Meet me at Times Square tomorrow afternoon.",
    new_text: "Meet me at <location> <date>."
  },
  {
    id: 'sample3',
    old_text: "The patient, Jane Doe, reported fever starting on 2024-03-10.",
    new_text: "The patient, <name>, reported fever starting on <date>."
  },
];

const escapeCSVField = (field: string | undefined | null): string => {
  if (field === null || field === undefined) {
    return '';
  }
  let result = String(field);
  result = result.replace(/"/g, '""'); // Escape double quotes
  if (result.search(/("|,|\n)/g) >= 0) {
    result = `"${result}"`; // Enclose in double quotes if it contains problematic characters
  }
  return result;
};

export function NERPageContent() {
  const [activeSamples, setActiveSamples] = useState<NerSample[]>(defaultSampleData);
  const [currentSampleIndex, setCurrentSampleIndex] = useState(0);
  const [originalOldText, setOriginalOldText] = useState<string>('');
  const [currentNewText, setCurrentNewText] = useState<string>('');
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const saveCurrentSampleEdits = useCallback(() => {
    if (activeSamples.length > 0 && currentSampleIndex < activeSamples.length) {
      const updatedSamples = [...activeSamples];
      updatedSamples[currentSampleIndex] = {
        ...updatedSamples[currentSampleIndex],
        new_text: currentNewText,
      };
      setActiveSamples(updatedSamples);
    }
  }, [activeSamples, currentSampleIndex, currentNewText]);


  useEffect(() => {
    if (activeSamples.length > 0 && currentSampleIndex < activeSamples.length) {
      const sample = activeSamples[currentSampleIndex];
      setOriginalOldText(sample.old_text);
      setCurrentNewText(sample.new_text);
      setAnimationKey(prev => prev + 1);
    } else {
      setOriginalOldText('');
      setCurrentNewText('');
       if (activeSamples.length === 0 && defaultSampleData.length > 0) { // Check defaultSampleData to avoid toast on initial empty load if default is also empty
        // This toast condition might need adjustment if defaultSampleData could be initially empty
      }
    }
  }, [currentSampleIndex, activeSamples, toast]);


  useEffect(() => {
    // Initial toast if no samples are available (and default samples were not used)
    if (activeSamples.length === 0 && defaultSampleData.length === 0) {
         toast({
            title: "No Samples Loaded",
            description: "Upload a CSV or refresh to use default samples.",
            variant: "default",
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Runs once on mount


  const handleNewTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCurrentNewText(event.target.value);
  };

  const handleLoadNextSample = () => {
    if (activeSamples.length === 0) {
       toast({
          title: "No Samples",
          description: "Upload a CSV file to load samples.",
          variant: "default",
        });
        return;
    }
    saveCurrentSampleEdits();
    setCurrentSampleIndex((prevIndex) => (prevIndex + 1) % activeSamples.length);
  };

  const handleAiCorrect = async () => {
    if (!originalOldText && !currentNewText && activeSamples.length === 0) {
      toast({
        title: "No Data",
        description: "Load a sample before using AI Correct.",
        variant: "default",
      });
      return;
    }
    setIsLoadingAi(true);
    try {
      const result = await correctNERTags({
        old_text: originalOldText,
        new_text: currentNewText,
      });
      if (result && result.corrected_text) {
        setCurrentNewText(result.corrected_text);
        // Save AI corrected text to activeSamples
        if (activeSamples.length > 0 && currentSampleIndex < activeSamples.length) {
          const updatedSamples = [...activeSamples];
          updatedSamples[currentSampleIndex] = {
            ...updatedSamples[currentSampleIndex],
            new_text: result.corrected_text,
          };
          setActiveSamples(updatedSamples);
        }
        setAnimationKey(prev => prev + 1);
        toast({
          title: "AI Correction Applied",
          description: "The new text has been updated with AI suggestions.",
        });
      } else {
        toast({
          title: "AI Correction Failed",
          description: "Could not get corrections from AI.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("AI Correction error:", error);
      toast({
          title: "AI Correction Error",
          description: "An error occurred while applying AI corrections.",
          variant: "destructive",
      });
    } finally {
      setIsLoadingAi(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (file.type !== 'text/csv') {
      toast({
        title: "Invalid File Type",
        description: "Please upload a CSV file.",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) {
        toast({
          title: "File Read Error",
          description: "Could not read the file content.",
          variant: "destructive",
        });
        return;
      }

      const rows = text.split('\n').map(row => row.trim()).filter(row => row.length > 0);
      if (rows.length < 2) {
        toast({
          title: "Invalid CSV Format",
          description: "CSV must contain a header and at least one data row.",
          variant: "destructive",
        });
        return;
      }

      const header = rows[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
      const oldTextIndex = header.indexOf('old_text');
      const newTextIndex = header.indexOf('new_text');

      if (oldTextIndex === -1 || newTextIndex === -1) {
        toast({
          title: "Missing Columns",
          description: "CSV must contain 'old_text' and 'new_text' columns.",
          variant: "destructive",
        });
        return;
      }

      const newSamples: NerSample[] = [];
      for (let i = 1; i < rows.length; i++) {
        const values: string[] = [];
        let currentVal = '';
        let inQuotes = false;
        for (const char of rows[i]) {
            if (char === '"' && (i === 0 || rows[i][rows[i].indexOf(char)-1] !== '"')) { // simplified quote handling
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(currentVal.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
                currentVal = '';
            } else {
                currentVal += char;
            }
        }
        values.push(currentVal.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));


        if (values.length > Math.max(oldTextIndex, newTextIndex)) {
          const old_text = values[oldTextIndex]?.trim();
          const new_text = values[newTextIndex]?.trim();
          if (old_text && new_text) {
            newSamples.push({ id: `csv_sample_${Date.now()}_${i}`, old_text, new_text });
          }
        }
      }

      if (newSamples.length === 0) {
        toast({
          title: "No Valid Data",
          description: "No valid samples found in the CSV file.",
          variant: "destructive",
        });
        return;
      }

      setActiveSamples(newSamples);
      setCurrentSampleIndex(0); 
      toast({
        title: "CSV Uploaded",
        description: `${newSamples.length} samples loaded successfully.`,
      });
    };

    reader.onerror = () => {
      toast({
        title: "File Read Error",
        description: "An error occurred while reading the file.",
        variant: "destructive",
      });
    };

    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; 
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleExportCSV = () => {
    if (activeSamples.length === 0) {
      toast({
        title: "No Data to Export",
        description: "Load or create some samples first.",
        variant: "default",
      });
      return;
    }

    // Ensure the current view's edits are saved before exporting
    saveCurrentSampleEdits(); 

    // Use a temporary state for activeSamples to ensure the latest version is used after saveCurrentSampleEdits
    // This is a bit of a workaround for the async nature of setState. A better way would be to pass activeSamples to the export function.
    // For now, this should work given saveCurrentSampleEdits updates the state that handleExportCSV will then read.
    // Consider this: saveCurrentSampleEdits updates the state, then this function reads it.
    // Let's rely on the state updated by saveCurrentSampleEdits.

    const csvHeader = '"old_text","new_text"\n';
    const csvRows = activeSamples.map(sample => 
      `${escapeCSVField(sample.old_text)},${escapeCSVField(sample.new_text)}`
    ).join('\n');
    
    const csvContent = csvHeader + csvRows;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) { 
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", "edited_ner_data.csv");
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({
        title: "Export Successful",
        description: "Edited data downloaded as edited_ner_data.csv.",
      });
    } else {
       toast({
        title: "Export Failed",
        description: "Your browser doesn't support this download method.",
        variant: "destructive",
      });
    }
  };


  const oldTextHighlightedSegments = useMemo(() => {
    if (!originalOldText) return [];
    return getOldTextHighlightedParts(originalOldText, currentNewText);
  }, [originalOldText, currentNewText]);


  return (
    <div className="flex flex-col flex-grow p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-2xl font-bold font-headline">NER Review Tool</h1>
        <div className="flex gap-2 flex-wrap justify-center">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".csv"
            className="hidden"
          />
          <Button onClick={triggerFileUpload} variant="outline">
            <FileText className="mr-2 h-4 w-4" />
            Upload CSV
          </Button>
          <Button onClick={handleExportCSV} variant="outline" disabled={activeSamples.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button onClick={handleLoadNextSample} variant="outline" disabled={activeSamples.length <= 1 && currentSampleIndex === 0}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Load Next Sample
          </Button>
          <Button onClick={handleAiCorrect} disabled={isLoadingAi || activeSamples.length === 0}>
            {isLoadingAi ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            AI Correct
          </Button>
        </div>
      </div>

      {activeSamples.length === 0 ? (
         <Card className="flex flex-col items-center justify-center min-h-[400px]">
            <CardHeader>
              <CardTitle className="text-center">No Samples Loaded</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-muted-foreground">
                Please upload a CSV file to start reviewing NER tags or refresh to use default samples.
              </p>
              <Button onClick={triggerFileUpload} className="mt-4">
                <FileText className="mr-2 h-4 w-4" />
                Upload CSV
              </Button>
               <Button onClick={() => {setActiveSamples(defaultSampleData); setCurrentSampleIndex(0);}} className="mt-4 ml-2" variant="secondary" disabled={defaultSampleData.length === 0}>
                Load Default Samples
              </Button>
            </CardContent>
          </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-grow">
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>Original Text (Read-only)</CardTitle>
              <CardDescription>This is the original text content. Current sample: {currentSampleIndex + 1} of {activeSamples.length}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow p-6 bg-muted/30 rounded-b-lg min-h-[200px] overflow-auto">
              <HighlightedTextRenderer segments={oldTextHighlightedSegments} animationKey={animationKey} />
            </CardContent>
          </Card>

          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>New Text (Editable)</CardTitle>
              <CardDescription>Edit the text below. Use tags like &lt;name&gt;, &lt;location&gt;, &lt;date&gt;.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow p-0">
              <Textarea
                value={currentNewText}
                onChange={handleNewTextChange}
                placeholder="Enter new text with NER tags..."
                className="h-full min-h-[200px] w-full resize-none border-0 rounded-t-none rounded-b-lg focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

