import mongoose from 'mongoose';

const TournamentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    year: { type: Number, required: true },
  },
  { timestamps: true, collection: 'tournaments' }
);

export const Tournament = mongoose.model('Tournament', TournamentSchema);
