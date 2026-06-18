GRANT SELECT ON public.brands TO anon;
GRANT SELECT ON public.products TO anon;
GRANT SELECT ON public.rules TO anon;

CREATE POLICY "Embedded app read brands"
  ON public.brands FOR SELECT TO anon USING (true);

CREATE POLICY "Embedded app read products"
  ON public.products FOR SELECT TO anon USING (true);

CREATE POLICY "Embedded app read rules"
  ON public.rules FOR SELECT TO anon USING (true);