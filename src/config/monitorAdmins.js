// Admins de monitoramento / "de serviço" — nunca devem aparecer como opção de profissional (grade da Agenda,
// vínculo de serviços, seletores). No produto de referência (ANG) isso é uma lista fixa de UUIDs de um salão;
// na Plataform (multi-salão) será um atributo do membro do salão (feature "Admin de serviço", ainda a portar).
// Enquanto isso a lista fica vazia e nenhum Admin é ocultado.
export function excludeMonitorAdmins(users) {
  return users.filter(u => !u.Is_monitor)
}
