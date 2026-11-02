-- One shop per email. This fails if two shops already share an email, which has to
-- be resolved by hand, because only an admin can say which shop should keep it.

-- CreateIndex
CREATE UNIQUE INDEX "Shop_email_key" ON "Shop"("email");
