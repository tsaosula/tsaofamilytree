export enum Gender {
  Male = 'MALE',
  Female = 'FEMALE',
  Other = 'OTHER'
}

export interface FamilyMember {
  id: string;
  name: string;
  gender: Gender;
  birthDate?: string;
  deathDate?: string;
  biography?: string;
  location?: string;
  phone?: string;
  spousePhone?: string;
  email?: string;
  
  // Specific fields for Tsao Family
  generation?: number; // 世代
  courtesyName?: string; // 字
  spouseName?: string; // Store spouse name string for parsing reference
  
  // Relations
  fatherId?: string;
  motherId?: string;
  fatherName?: string; // Original father name from import or fallback
  motherName?: string; // Original mother name from import or fallback
  spouseIds?: string[];
  childrenIds?: string[];
}

export interface TreeDataNode {
  name: string;
  attributes?: Record<string, string | number | undefined>;
  children?: TreeDataNode[];
  memberId: string; // Link back to full data
}

export type ViewMode = 'TREE' | 'LIST' | 'GALLERY';