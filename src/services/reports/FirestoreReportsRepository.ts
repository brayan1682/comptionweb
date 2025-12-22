import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  orderBy,
  where,
  Timestamp
} from "firebase/firestore";
import type { Report } from "../../domain/types";
import { newId, nowIso } from "../utils";
import type { CreateReportInput, ReportsRepository } from "./ReportsRepository";
import { db } from "../../firebase/firebase";

export class FirestoreReportsRepository implements ReportsRepository {
  private timestampToIso(timestamp: any): string {
    if (timestamp?.toDate) {
      return timestamp.toDate().toISOString();
    }
    if (typeof timestamp === "string") {
      return timestamp;
    }
    return new Date().toISOString();
  }

  private isoToTimestamp(iso: string): Timestamp {
    return Timestamp.fromDate(new Date(iso));
  }

  async create(input: CreateReportInput, reporterId: string): Promise<Report> {
    const now = nowIso();
    const report: Report = {
      id: newId(),
      reporterId,
      targetType: input.targetType,
      targetId: input.targetId,
      questionId: input.questionId || null,
      reason: input.reason,
      description: input.description.trim(),
      status: "pending",
      reviewedBy: null,
      reviewedAt: null,
      createdAt: now,
    };

    const reportRef = doc(collection(db, "reports"), report.id);
    await setDoc(reportRef, {
      ...report,
      createdAt: this.isoToTimestamp(report.createdAt),
    });

    return report;
  }

  async listPending(): Promise<Report[]> {
    const reportsRef = collection(db, "reports");
    const q = query(reportsRef, where("status", "==", "pending"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        reporterId: data.reporterId,
        targetType: data.targetType,
        targetId: data.targetId,
        questionId: data.questionId || null,
        reason: data.reason,
        description: data.description,
        status: data.status,
        reviewedBy: data.reviewedBy || null,
        reviewedAt: data.reviewedAt ? this.timestampToIso(data.reviewedAt) : null,
        createdAt: this.timestampToIso(data.createdAt),
      };
    });
  }

  async listAll(): Promise<Report[]> {
    const reportsRef = collection(db, "reports");
    const q = query(reportsRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        reporterId: data.reporterId,
        targetType: data.targetType,
        targetId: data.targetId,
        questionId: data.questionId || null,
        reason: data.reason,
        description: data.description,
        status: data.status,
        reviewedBy: data.reviewedBy || null,
        reviewedAt: data.reviewedAt ? this.timestampToIso(data.reviewedAt) : null,
        createdAt: this.timestampToIso(data.createdAt),
      };
    });
  }

  async getById(id: string): Promise<Report | null> {
    const reportDoc = await getDoc(doc(db, "reports", id));
    if (!reportDoc.exists()) {
      return null;
    }
    
    const data = reportDoc.data();
    return {
      id: reportDoc.id,
      reporterId: data.reporterId,
      targetType: data.targetType,
      targetId: data.targetId,
      questionId: data.questionId || null,
      reason: data.reason,
      description: data.description,
      status: data.status,
      reviewedBy: data.reviewedBy || null,
      reviewedAt: data.reviewedAt ? this.timestampToIso(data.reviewedAt) : null,
      createdAt: this.timestampToIso(data.createdAt),
    };
  }

  async updateStatus(id: string, status: Report["status"], reviewedBy: string): Promise<Report> {
    const reportRef = doc(db, "reports", id);
    const now = nowIso();
    
    await updateDoc(reportRef, {
      status,
      reviewedBy,
      reviewedAt: this.isoToTimestamp(now),
    });

    const updated = await this.getById(id);
    if (!updated) {
      throw new Error("Reporte no encontrado después de actualizar");
    }
    return updated;
  }

  reset(): void {
    // No hay nada que resetear en Firestore (esto es para testing)
  }
}




