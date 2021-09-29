import mongoose, { Schema } from 'mongoose'

const reqString = {
  type: String,
  required: true,
}

const schema = new Schema({
  _id: reqString,
  nameAndClient: reqString,
  guild: reqString,
  description: String,
  options: Object,
})

const name = 'wokcommands-slash-commands'

export = mongoose.models[name] || mongoose.model(name, schema, name)
