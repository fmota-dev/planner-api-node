import dayjs from "dayjs";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import nodemailer from "nodemailer";
import { z } from "zod";
import { getMailClient } from "../../lib/mail";
import { prisma } from "../../lib/prisma";
import { ClientError } from "../../errors/client-error";
import { env } from "../../env";

export async function createInvite(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    "/trips/:tripId/invites",
    {
      schema: {
        params: z.object({
          tripId: z.string().uuid(),
        }),
        body: z.object({
          email: z.string().email(),
        }),
      },
    },
    async (request) => {
      const { tripId } = request.params;
      const { email } = request.body;

      const trip = await prisma.trip.findUnique({
        where: { id: tripId },
      });

      if (!trip) {
        throw new ClientError("Trip not found");
      }

      const participant = await prisma.participant.create({
        data: {
          email,
          trip_id: tripId,
        },
      });

      const formattedStartsAt = dayjs(trip.starts_at).format("DD/MM/YYYY");
      const formattedEndsAt = dayjs(trip.ends_at).format("DD/MM/YYYY");

      const mail = await getMailClient();

      const confirmationLink = `${env.API_BASE_URL}/participants/${participant.id}/confirm`;

      const message = await mail.sendMail({
        from: {
          name: "Equipe plann.er",
          address: "suporte@plann.er",
        },
        to: participant.email,
        subject: `Confirme sua presença na viagem para ${trip.destination} em ${formattedStartsAt}`,
        html: `<div style="font-family: sans-serif; font-size: 1rem; line-height: 1.6;">
									<p>Você foi convidado para uma viagem para <strong>${trip.destination}</strong> nas datas de <strong>${formattedStartsAt} até ${formattedEndsAt}</strong>.</p>
									<p>Para confirmar sua presença na viagem, clique no link abaixo:</p>
									<p><a href="${confirmationLink}">Confirmar viagem</a></p>
									<p>Caso você não saiba do que se trata esse e-mail, apenas ignore esse e-mail.</p>
							</div>`.trim(),
      });

      console.log(nodemailer.getTestMessageUrl(message));

      return { participantId: participant.id };
    }
  );
}
