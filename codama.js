import { createCodamaConfig } from "gill";
 
export default createCodamaConfig({
  idl: "idl/p_vote.json",
  clientJs: "clients/js/src/generated",
});