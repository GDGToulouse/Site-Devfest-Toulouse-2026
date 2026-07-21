-- AlterTable
ALTER TABLE "Edition" ADD COLUMN     "venueDirectionsUrl" TEXT,
ADD COLUMN     "venueLat" DOUBLE PRECISION,
ADD COLUMN     "venueLng" DOUBLE PRECISION,
ADD COLUMN     "venueParking" TEXT,
ADD COLUMN     "venueTransports" TEXT;
