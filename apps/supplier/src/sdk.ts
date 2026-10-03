// The only import of the supplier app's own OSDK package. Its Developer Console app holds only CsCountry (program
// names) and the submit Action in its resource scope, so this site cannot read a price, a bid, or a volume (D9, P11).
export * from "@clearspend-suppliers/sdk";
